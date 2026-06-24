#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-apply-pr-worker.sh <pr-number>

Checks out an OpenSpec artifact PR into its same branch worktree, then runs
opencode unattended to implement the change in that same PR.

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

ensure_label() {
  local name="$1" color="$2" description="$3"
  gh label create "$name" --color "$color" --description "$description" >/dev/null 2>&1 || true
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
mkdir -p "$WORKTREE_BASE" "$STATE_DIR"

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
if [[ -z "$DEFAULT_BRANCH" || "$DEFAULT_BRANCH" == "null" ]]; then
  DEFAULT_BRANCH="main"
fi

ensure_label openspec-apply-ready 0E8A16 "OpenSpec artifact PR is approved for implementation"
ensure_label openspec-implementing F9D0C4 "OpenSpec implementation agent is running"
ensure_label agent-feedback-ready D4C5F9 "PR feedback may be handled by opencode"
ensure_label agent-done 0E8A16 "Agent believes work is ready for human review"
ensure_label agent-blocked D93F0B "Agent stopped and needs human help"

PR_JSON="$(gh pr view "$PR_NUMBER" --json title,url,body,headRefName,number,labels)"
PR_TITLE="$(printf '%s' "$PR_JSON" | jq -r '.title')"
PR_URL="$(printf '%s' "$PR_JSON" | jq -r '.url')"
PR_BODY="$(printf '%s' "$PR_JSON" | jq -r '.body // ""')"
BRANCH="$(printf '%s' "$PR_JSON" | jq -r '.headRefName')"

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
git fetch origin "$DEFAULT_BRANCH" --quiet

CHANGE_NAME="$(git diff --name-only "origin/$DEFAULT_BRANCH"...HEAD | sed -nE 's#^openspec/changes/([^/]+)/.*#\1#p' | sort -u | head -n 1)"
if [[ -z "$CHANGE_NAME" ]]; then
  CHANGE_NAME="$(printf '%s' "$PR_BODY" | sed -nE 's/.*openspec\/changes\/([^/`[:space:]]+).*/\1/p' | head -n 1)"
fi
if [[ -z "$CHANGE_NAME" ]]; then
  echo "Could not infer OpenSpec change from PR #$PR_NUMBER." >&2
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-blocked" >/dev/null 2>&1 || true
  exit 1
fi

ISSUE_NUMBER="$(printf '%s' "$PR_BODY" | sed -nE 's/.*(Refs|Closes)[[:space:]]+#([0-9]+).*/\2/p' | head -n 1)"

gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=openspec-implementing" >/dev/null 2>&1 || true

PROMPT="$(cat <<EOF
Use the openspec-apply-change skill to implement OpenSpec change ${CHANGE_NAME} in this same PR branch.

PR: ${PR_TITLE}
URL: ${PR_URL}
PR number: #${PR_NUMBER}
Branch: ${BRANCH}
Worktree: ${WORKTREE}
${ISSUE_NUMBER:+Original issue: #${ISSUE_NUMBER}}

Run unattended but self-enforce these rules:
- Work only in this worktree: ${WORKTREE}
- Read proposal.md, design.md, tasks.md, and relevant specs for ${CHANGE_NAME} before editing application code.
- Confirm artifacts are coherent and apply-ready before implementation.
- Implement the tasks in openspec/changes/${CHANGE_NAME}/tasks.md.
- Keep scope to the approved OpenSpec artifacts. If implementation reveals scope change, stop and report instead of silently expanding.
- Mark completed tasks in tasks.md.
- Run relevant verification and openspec status for ${CHANGE_NAME}.
- Use the ship skill to commit, push, and update this same PR branch.
- PR body must mention OpenSpec change ${CHANGE_NAME} and exact tasks completed.
${ISSUE_NUMBER:+- After implementation is complete, PR body should include "Closes #${ISSUE_NUMBER}".}
- Keep label agent-feedback-ready on the PR so /opencode feedback can be handled.
- Do not archive the OpenSpec change.
EOF
)"

METRICS_FILE="$STATE_DIR/agent-loop-metrics-apply-pr-${PR_NUMBER}-$(date +%Y%m%d%H%M%S).json"
RUN_ARGS=(run --dir "$WORKTREE" --title "openspec-apply-pr-${PR_NUMBER}" --dangerously-skip-permissions)
if [[ -n "${OPENCODE_MODEL:-}" ]]; then
  RUN_ARGS+=(--model "$OPENCODE_MODEL")
fi
if [[ -n "${OPENCODE_RUN_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_FLAGS=(${OPENCODE_RUN_FLAGS})
  RUN_ARGS+=("${EXTRA_FLAGS[@]}")
fi

set +e
OPENCODE_AGENT_LOOP_METRICS_FILE="$METRICS_FILE" \
OPENCODE_AGENT_LOOP_PHASE="implementation" \
OPENCODE_AGENT_LOOP_PR="$PR_NUMBER" \
OPENCODE_AGENT_LOOP_BRANCH="$BRANCH" \
opencode "${RUN_ARGS[@]}" "$PROMPT"
OPENCODE_RC=$?
set -e

if [[ "$OPENCODE_RC" -ne 0 ]]; then
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-blocked" >/dev/null 2>&1 || true
  exit "$OPENCODE_RC"
fi

if [[ -n "$ISSUE_NUMBER" ]]; then
  UPDATED_BODY="${PR_BODY/Refs #$ISSUE_NUMBER/Closes #$ISSUE_NUMBER}"
  if [[ "$UPDATED_BODY" != *"Closes #$ISSUE_NUMBER"* ]]; then
    UPDATED_BODY="${UPDATED_BODY}

Closes #${ISSUE_NUMBER}"
  fi
  gh pr edit "$PR_NUMBER" --body "$UPDATED_BODY" >/dev/null 2>&1 || true
fi

gh issue edit "$PR_NUMBER" --remove-label openspec-apply-ready >/dev/null 2>&1 || true
gh issue edit "$PR_NUMBER" --remove-label openspec-implementing >/dev/null 2>&1 || true
gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-feedback-ready" >/dev/null 2>&1 || true
gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-done" >/dev/null 2>&1 || true
.opencode/scripts/openspec-post-agent-loop-metrics.sh "$PR_NUMBER" "$METRICS_FILE" || true

printf 'OpenSpec implementation complete for PR #%s.\n' "$PR_NUMBER"
