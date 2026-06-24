#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-pr-feedback-worker.sh <pr-number>

Handles unprocessed PR feedback beginning with /opencode on an agent-managed PR.
The worker reacts with eyes when picked up, runs opencode against the same PR
branch, then marks feedback IDs processed after a successful push.

Environment:
  WORKTREE_BASE       Optional parent directory for worktrees. Defaults to ../<repo-name>-worktrees.
  FEEDBACK_TRIGGER    Optional comment prefix. Defaults to /opencode.
  OPENCODE_MODEL      Optional model override, e.g. openai/gpt-5.5.
  OPENCODE_RUN_FLAGS  Optional extra flags passed to opencode run.
USAGE
}

abs_path() {
  local path="$1"
  if [[ -d "$path" ]]; then
    (cd "$path" && pwd -P)
  else
    local dir base
    dir="$(dirname "$path")"
    base="$(basename "$path")"
    (cd "$dir" && printf '%s/%s\n' "$(pwd -P)" "$base")
  fi
}

ensure_label() {
  local name="$1" color="$2" description="$3"
  gh label create "$name" --color "$color" --description "$description" >/dev/null 2>&1 || true
}

react_issue_comment() {
  local id="$1" content="$2"
  gh api "repos/:owner/:repo/issues/comments/${id}/reactions" \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    -f "content=${content}" >/dev/null 2>&1 || true
}

react_review_comment() {
  local id="$1" content="$2"
  gh api "repos/:owner/:repo/pulls/comments/${id}/reactions" \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    -f "content=${content}" >/dev/null 2>&1 || true
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 1
fi

PR_NUMBER="${1#\#}"

for cmd in gh git jq opencode; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required and was not found." >&2
    exit 1
  fi
done

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Must be run inside a git repository." >&2
  exit 1
fi

WORKTREE_ROOT="$(git rev-parse --show-toplevel)"
GIT_COMMON_DIR="$(git rev-parse --git-common-dir)"
if [[ "$GIT_COMMON_DIR" != /* ]]; then
  GIT_COMMON_DIR="$WORKTREE_ROOT/$GIT_COMMON_DIR"
fi
GIT_COMMON_DIR="$(abs_path "$GIT_COMMON_DIR")"

if [[ "$(basename "$GIT_COMMON_DIR")" == ".git" ]]; then
  REPO_ROOT="$(dirname "$GIT_COMMON_DIR")"
else
  REPO_ROOT="$WORKTREE_ROOT"
fi

cd "$REPO_ROOT"

REPO_NAME="$(basename "$REPO_ROOT")"
WORKTREE_BASE="${WORKTREE_BASE:-$(dirname "$REPO_ROOT")/${REPO_NAME}-worktrees}"
STATE_DIR="${STATE_DIR:-$HOME/.opencode/state/$REPO_NAME}"
PROCESSED_FILE="$STATE_DIR/pr-${PR_NUMBER}-opencode-feedback-processed.txt"
FEEDBACK_TRIGGER="${FEEDBACK_TRIGGER:-/opencode}"
mkdir -p "$WORKTREE_BASE" "$STATE_DIR"
touch "$PROCESSED_FILE"

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
if [[ -z "$DEFAULT_BRANCH" || "$DEFAULT_BRANCH" == "null" ]]; then
  DEFAULT_BRANCH="main"
fi

ensure_label agent-feedback-ready D4C5F9 "PR feedback may be handled by opencode"
ensure_label openspec-implementing F9D0C4 "OpenSpec implementation agent is running"
ensure_label agent-done 0E8A16 "Agent believes work is ready for human review"
ensure_label agent-blocked D93F0B "Agent stopped and needs human help"

PR_JSON="$(gh pr view "$PR_NUMBER" --json title,url,body,headRefName,number)"
PR_TITLE="$(printf '%s' "$PR_JSON" | jq -r '.title')"
PR_URL="$(printf '%s' "$PR_JSON" | jq -r '.url')"
PR_BODY="$(printf '%s' "$PR_JSON" | jq -r '.body // ""')"
BRANCH="$(printf '%s' "$PR_JSON" | jq -r '.headRefName')"

ISSUE_COMMENTS_JSON="$(gh api "repos/:owner/:repo/issues/${PR_NUMBER}/comments?per_page=100" 2>/dev/null || printf '[]')"
INLINE_COMMENTS_JSON="$(gh api "repos/:owner/:repo/pulls/${PR_NUMBER}/comments?per_page=100" 2>/dev/null || printf '[]')"
REVIEWS_JSON="$(gh api "repos/:owner/:repo/pulls/${PR_NUMBER}/reviews?per_page=100" 2>/dev/null || printf '[]')"

PROCESSED_JSON="$(jq -R -s 'split("\n") | map(select(length > 0))' "$PROCESSED_FILE")"

ISSUE_FEEDBACK="$(jq -r --argjson done "$PROCESSED_JSON" --arg trigger "$FEEDBACK_TRIGGER" '
  [.[]
    | select((.body // "") | startswith($trigger))
    | ("issue-comment:" + (.id|tostring)) as $key
    | select(($done | index($key)) | not)
    | "### [PR comment] id=\(.id) @\(.user.login) at \(.created_at):\n\(.body)"
  ] | join("\n\n---\n\n")
' <<< "$ISSUE_COMMENTS_JSON")"

INLINE_FEEDBACK="$(jq -r --argjson done "$PROCESSED_JSON" --arg trigger "$FEEDBACK_TRIGGER" '
  [.[]
    | select((.body // "") | startswith($trigger))
    | ("inline-comment:" + (.id|tostring)) as $key
    | select(($done | index($key)) | not)
    | "### [inline review comment] id=\(.id) @\(.user.login) at \(.created_at) -- \(.path):\(.line // .original_line // "?"):\n\(.body)"
  ] | join("\n\n---\n\n")
' <<< "$INLINE_COMMENTS_JSON")"

REVIEW_FEEDBACK="$(jq -r --argjson done "$PROCESSED_JSON" --arg trigger "$FEEDBACK_TRIGGER" '
  [.[]
    | select((.body // "") | startswith($trigger))
    | ("review:" + (.id|tostring)) as $key
    | select(($done | index($key)) | not)
    | "### [review summary] id=\(.id) @\(.user.login) at \(.submitted_at) -- \(.state):\n\(.body)"
  ] | join("\n\n---\n\n")
' <<< "$REVIEWS_JSON")"

NEW_KEYS="$(
  {
    jq -r --argjson done "$PROCESSED_JSON" --arg trigger "$FEEDBACK_TRIGGER" '.[] | select((.body // "") | startswith($trigger)) | "issue-comment:" + (.id|tostring) as $key | select(($done | index($key)) | not) | $key' <<< "$ISSUE_COMMENTS_JSON"
    jq -r --argjson done "$PROCESSED_JSON" --arg trigger "$FEEDBACK_TRIGGER" '.[] | select((.body // "") | startswith($trigger)) | "inline-comment:" + (.id|tostring) as $key | select(($done | index($key)) | not) | $key' <<< "$INLINE_COMMENTS_JSON"
    jq -r --argjson done "$PROCESSED_JSON" --arg trigger "$FEEDBACK_TRIGGER" '.[] | select((.body // "") | startswith($trigger)) | "review:" + (.id|tostring) as $key | select(($done | index($key)) | not) | $key' <<< "$REVIEWS_JSON"
  } | sort -u
)"

if [[ -z "$NEW_KEYS" ]]; then
  printf 'No unprocessed %s feedback for PR #%s.\n' "$FEEDBACK_TRIGGER" "$PR_NUMBER"
  exit 0
fi

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  case "$key" in
    issue-comment:*) react_issue_comment "${key#issue-comment:}" eyes ;;
    inline-comment:*) react_review_comment "${key#inline-comment:}" eyes ;;
  esac
done <<< "$NEW_KEYS"

WORKTREE="$WORKTREE_BASE/$BRANCH"
git fetch origin "$DEFAULT_BRANCH" --quiet
git fetch origin "$BRANCH:$BRANCH" --quiet 2>/dev/null || true

if [[ ! -d "$WORKTREE" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git worktree add "$WORKTREE" "$BRANCH"
  else
    git worktree add -b "$BRANCH" "$WORKTREE" "origin/$DEFAULT_BRANCH"
  fi
else
  echo "Reusing existing worktree: $WORKTREE"
fi

cd "$WORKTREE"

CHANGE_NAME="$(git diff --name-only "origin/$DEFAULT_BRANCH"...HEAD | sed -nE 's#^openspec/changes/([^/]+)/.*#\1#p' | sort -u | head -n 1)"
if [[ -z "$CHANGE_NAME" ]]; then
  CHANGE_NAME="$(printf '%s' "$PR_BODY" | sed -nE 's/.*openspec\/changes\/([^/`[:space:]]+).*/\1/p' | head -n 1)"
fi

gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=openspec-implementing" >/dev/null 2>&1 || true

PROMPT="$(cat <<EOF
Address new human feedback on PR #${PR_NUMBER} in the same PR branch.

PR: ${PR_TITLE}
URL: ${PR_URL}
Branch: ${BRANCH}
Worktree: ${WORKTREE}
${CHANGE_NAME:+OpenSpec change: ${CHANGE_NAME}}

Only process feedback that begins with ${FEEDBACK_TRIGGER}. Treat each item below as human-in-the-loop direction.

UNPROCESSED REVIEW SUMMARIES:
---
${REVIEW_FEEDBACK:-(none)}
---

UNPROCESSED INLINE REVIEW COMMENTS:
---
${INLINE_FEEDBACK:-(none)}
---

UNPROCESSED PR COMMENTS:
---
${ISSUE_FEEDBACK:-(none)}
---

Run unattended but self-enforce these rules:
- Work only in this worktree: ${WORKTREE}
- Read the full feedback above before editing.
- If feedback requests a code/spec/task change and it fits current PR scope, implement it.
- If feedback requests a scope change, update OpenSpec artifacts first when appropriate; otherwise explain why it is out of scope in a PR comment.
- Do not silently defer work. If deferring, create or reference a tracking issue and explain in a PR comment.
- Run relevant verification and openspec status if ${CHANGE_NAME:-an OpenSpec change} is present.
- Use the ship skill to commit, push, and update this same PR branch.
- Reply on PR #${PR_NUMBER} with a concise summary of what changed and any deferred items.
- Keep label agent-feedback-ready on the PR.
- Do not archive the OpenSpec change.
EOF
)"

RUN_ARGS=(run --dir "$WORKTREE" --title "openspec-feedback-pr-${PR_NUMBER}" --dangerously-skip-permissions)
if [[ -n "${OPENCODE_MODEL:-}" ]]; then
  RUN_ARGS+=(--model "$OPENCODE_MODEL")
fi
if [[ -n "${OPENCODE_RUN_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_FLAGS=(${OPENCODE_RUN_FLAGS})
  RUN_ARGS+=("${EXTRA_FLAGS[@]}")
fi

set +e
opencode "${RUN_ARGS[@]}" "$PROMPT"
OPENCODE_RC=$?
set -e

if [[ "$OPENCODE_RC" -ne 0 ]]; then
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-blocked" >/dev/null 2>&1 || true
  exit "$OPENCODE_RC"
fi

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  printf '%s\n' "$key" >> "$PROCESSED_FILE"
  case "$key" in
    issue-comment:*) react_issue_comment "${key#issue-comment:}" hooray ;;
    inline-comment:*) react_review_comment "${key#inline-comment:}" hooray ;;
  esac
done <<< "$NEW_KEYS"
sort -u "$PROCESSED_FILE" -o "$PROCESSED_FILE"

gh issue edit "$PR_NUMBER" --remove-label openspec-implementing >/dev/null 2>&1 || true
gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-done" >/dev/null 2>&1 || true

printf 'Processed %s feedback for PR #%s.\n' "$FEEDBACK_TRIGGER" "$PR_NUMBER"
