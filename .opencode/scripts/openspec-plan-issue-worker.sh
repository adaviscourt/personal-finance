#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-plan-issue-worker.sh <issue-number>

Creates or reuses a planning worktree for one raw GitHub issue, then runs
opencode unattended to create OpenSpec artifacts and open a same-PR planning PR.

Environment:
  WORKTREE_BASE       Optional parent directory for worktrees. Defaults to ../<repo-name>-worktrees.
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

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

ensure_label() {
  local name="$1" color="$2" description="$3"
  gh label create "$name" --color "$color" --description "$description" >/dev/null 2>&1 || true
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 1
fi

ISSUE_NUMBER="${1#\#}"

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
mkdir -p "$WORKTREE_BASE" "$STATE_DIR"

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
if [[ -z "$DEFAULT_BRANCH" || "$DEFAULT_BRANCH" == "null" ]]; then
  DEFAULT_BRANCH="main"
fi

ensure_label agent-ready 5319E7 "Ready for local opencode agent pickup"
ensure_label openspec-planning C5DEF5 "OpenSpec planning agent is running"
ensure_label openspec-review-ready FBCA04 "OpenSpec artifact PR is ready for review"
ensure_label openspec-apply-ready 0E8A16 "OpenSpec artifact PR is approved for implementation"
ensure_label openspec-implementing F9D0C4 "OpenSpec implementation agent is running"
ensure_label agent-feedback-ready D4C5F9 "PR feedback may be handled by opencode"
ensure_label agent-done 0E8A16 "Agent believes work is ready for human review"
ensure_label agent-blocked D93F0B "Agent stopped and needs human help"

ISSUE_JSON="$(gh issue view "$ISSUE_NUMBER" --json title,url,body,comments,labels,author,assignees)"
ISSUE_TITLE="$(printf '%s' "$ISSUE_JSON" | jq -r '.title')"
ISSUE_URL="$(printf '%s' "$ISSUE_JSON" | jq -r '.url')"
ISSUE_BODY="$(printf '%s' "$ISSUE_JSON" | jq -r '.body // ""')"
ISSUE_COMMENTS="$(printf '%s' "$ISSUE_JSON" | jq -r '
  if (.comments | length) == 0 then
    "(no comments)"
  else
    .comments
    | map("--- @\(.author.login) at \(.createdAt):\n\(.body)")
    | join("\n\n")
  end
')"

SLUG="$(slugify "$ISSUE_TITLE")"
if [[ -z "$SLUG" ]]; then
  SLUG="issue-$ISSUE_NUMBER"
fi
CHANGE_NAME="${SLUG}"
BRANCH="openspec-issue-${ISSUE_NUMBER}-${SLUG}"
WORKTREE="$WORKTREE_BASE/$BRANCH"

git fetch origin "$DEFAULT_BRANCH" --quiet

if [[ ! -d "$WORKTREE" ]]; then
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git worktree add "$WORKTREE" "$BRANCH"
  else
    git worktree add -b "$BRANCH" "$WORKTREE" "origin/$DEFAULT_BRANCH"
  fi
else
  echo "Reusing existing worktree: $WORKTREE"
fi

gh issue edit "$ISSUE_NUMBER" --remove-label agent-ready >/dev/null 2>&1 || true
gh issue edit "$ISSUE_NUMBER" --add-label openspec-planning >/dev/null

PROMPT="$(cat <<EOF
Use the openspec-ff-change skill to create OpenSpec artifacts from GitHub issue #${ISSUE_NUMBER}.

Issue: ${ISSUE_TITLE}
URL: ${ISSUE_URL}
Suggested change name: ${CHANGE_NAME}

Issue body:
---
${ISSUE_BODY}
---

Issue comments:
---
${ISSUE_COMMENTS}
---

Run unattended but self-enforce these rules:
- Work only in this planning worktree: ${WORKTREE}
- Create OpenSpec artifacts for change name ${CHANGE_NAME} unless a better kebab-case name is clearly required by the issue.
- Use openspec-ff-change so proposal, specs, design, and tasks are created to apply-ready state.
- Do not implement application code in this planning phase except generated OpenSpec artifacts and minimal issue/PR metadata edits.
- Run OpenSpec validation/status checks after creating artifacts.
- Use the ship skill to commit, push, and open a PR from this same branch.
- PR title should make clear this is OpenSpec planning.
- PR body must include "Refs #${ISSUE_NUMBER}" and must NOT include "Closes #${ISSUE_NUMBER}" yet.
- PR body must explain that adding label openspec-apply-ready to this PR authorizes implementation in the same PR.
- Add PR label openspec-review-ready if possible.
- If blocked or scope is unclear, stop and report. Do not invent broad implementation scope.
EOF
)"

RUN_ARGS=(run --dir "$WORKTREE" --title "openspec-plan-issue-${ISSUE_NUMBER}" --dangerously-skip-permissions)
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
  gh issue edit "$ISSUE_NUMBER" --add-label agent-blocked >/dev/null 2>&1 || true
  exit "$OPENCODE_RC"
fi

PR_JSON="$(gh pr list --head "$BRANCH" --state open --json number,url --jq '.[0] // empty')"
if [[ -n "$PR_JSON" ]]; then
  PR_NUMBER="$(printf '%s' "$PR_JSON" | jq -r '.number')"
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=openspec-review-ready" >/dev/null 2>&1 || true
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-feedback-ready" >/dev/null 2>&1 || true
fi

gh issue edit "$ISSUE_NUMBER" --remove-label openspec-planning >/dev/null 2>&1 || true
gh issue edit "$ISSUE_NUMBER" --add-label openspec-review-ready >/dev/null 2>&1 || true

printf 'OpenSpec planning complete for issue #%s.\n' "$ISSUE_NUMBER"
