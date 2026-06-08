#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-dispatch-issue.sh <issue-number>
  .opencode/scripts/openspec-dispatch-issue.sh --next <change-name>

Creates or reuses a git worktree for one OpenSpec-linked GitHub issue.

Arguments:
  issue-number   GitHub issue number, with or without leading #. The OpenSpec change is inferred from the issue body or milestone.
  --next         Select the lowest-numbered open issue in the given OpenSpec change milestone.

Environment:
  WORKTREE_BASE  Optional parent directory for worktrees. Defaults to ../<repo-name>-worktrees.
USAGE
}

abs_path() {
  local path="$1"
  if [[ -d "$path" ]]; then
    (cd "$path" && pwd -P)
  else
    local dir
    dir="$(dirname "$path")"
    local base
    base="$(basename "$path")"
    (cd "$dir" && printf '%s/%s\n' "$(pwd -P)" "$base")
  fi
}

MODE="issue"
ISSUE_NUMBER=""
CHANGE_NAME=""

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 1
fi

if [[ "${1:-}" == "--next" ]]; then
  MODE="next"
  CHANGE_NAME="${2:-}"
  if [[ -z "$CHANGE_NAME" ]]; then
    usage
    exit 1
  fi
else
  ISSUE_NUMBER="${1#\#}"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required and was not found." >&2
  exit 1
fi

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
mkdir -p "$WORKTREE_BASE"

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
if [[ -z "$DEFAULT_BRANCH" || "$DEFAULT_BRANCH" == "null" ]]; then
  DEFAULT_BRANCH="main"
fi

gh label create openspec-in-progress --description "OpenSpec issue currently being worked" --color F9D0C4 >/dev/null 2>&1 || true
gh label create openspec-done --description "OpenSpec issue completed" --color 0E8A16 >/dev/null 2>&1 || true
gh label create agent-ready --description "Ready for local opencode agent pickup" --color 5319E7 >/dev/null 2>&1 || true

if [[ "$MODE" == "next" ]]; then
  IN_PROGRESS="$(gh issue list --milestone "$CHANGE_NAME" --state open --label openspec-in-progress --json number,title --jq '.[] | "#\(.number) \(.title)"')"
  if [[ -n "$IN_PROGRESS" ]]; then
    echo "Another issue is already in progress for milestone '$CHANGE_NAME':" >&2
    echo "$IN_PROGRESS" >&2
    echo "Continue that issue or clear the openspec-in-progress label before dispatching the next one." >&2
    exit 1
  fi

  SELECTED="$(gh issue list --milestone "$CHANGE_NAME" --state open --json number,title,labels --jq 'sort_by(.number)[] | select(([.labels[].name] | index("openspec-in-progress")) | not) | "\(.number)|\(.title)"' | head -n 1)"
  if [[ -z "$SELECTED" ]]; then
    echo "No open issues found for milestone '$CHANGE_NAME'." >&2
    exit 1
  fi
  ISSUE_NUMBER="${SELECTED%%|*}"
fi

ISSUE_TITLE="$(gh issue view "$ISSUE_NUMBER" --json title --jq '.title')"
ISSUE_BODY="$(gh issue view "$ISSUE_NUMBER" --json body --jq '.body // ""')"
MILESTONE_TITLE="$(gh issue view "$ISSUE_NUMBER" --json milestone --jq '.milestone.title // ""')"

if [[ -z "$CHANGE_NAME" ]]; then
  CHANGE_NAME="$(printf '%s' "$ISSUE_BODY" | sed -nE 's/^OpenSpec change:[[:space:]]*`([^`]+)`.*/\1/p' | head -n 1)"
fi

if [[ -z "$CHANGE_NAME" ]]; then
  CHANGE_NAME="$MILESTONE_TITLE"
fi

if [[ -z "$CHANGE_NAME" ]]; then
  echo "Could not infer OpenSpec change from issue #$ISSUE_NUMBER body or milestone." >&2
  exit 1
fi

if [[ ! -f "openspec/changes/$CHANGE_NAME/tasks.md" ]]; then
  echo "Missing OpenSpec tasks file: openspec/changes/$CHANGE_NAME/tasks.md" >&2
  exit 1
fi

if [[ ! -f "openspec/changes/$CHANGE_NAME/proposal.md" ]]; then
  echo "Missing OpenSpec proposal file: openspec/changes/$CHANGE_NAME/proposal.md" >&2
  exit 1
fi

if ! grep -Eq '^(Status: [Aa]pproved|Approved:|Approver:|## Approval)' "openspec/changes/$CHANGE_NAME/proposal.md"; then
  echo "Proposal approval marker missing in openspec/changes/$CHANGE_NAME/proposal.md" >&2
  exit 1
fi

if [[ -n "$MILESTONE_TITLE" && "$MILESTONE_TITLE" != "$CHANGE_NAME" ]]; then
  echo "Issue #$ISSUE_NUMBER milestone '$MILESTONE_TITLE' does not match inferred OpenSpec change '$CHANGE_NAME'." >&2
  exit 1
fi

IN_PROGRESS_OTHER="$(gh issue list --milestone "$CHANGE_NAME" --state open --label openspec-in-progress --json number,title --jq ".[] | select(.number != $ISSUE_NUMBER) | \"#\\(.number) \\(.title)\"")"
if [[ -n "$IN_PROGRESS_OTHER" ]]; then
  echo "Another issue is already in progress for milestone '$CHANGE_NAME':" >&2
  echo "$IN_PROGRESS_OTHER" >&2
  echo "Continue that issue or clear the openspec-in-progress label before dispatching #$ISSUE_NUMBER." >&2
  exit 1
fi

SLUG="$(printf '%s' "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g')"
BRANCH="issue-${ISSUE_NUMBER}-${SLUG}"
WORKTREE="$WORKTREE_BASE/$BRANCH"

git fetch origin "$DEFAULT_BRANCH" --quiet

if [[ ! -d "$WORKTREE" ]]; then
  git worktree add -b "$BRANCH" "$WORKTREE" "origin/$DEFAULT_BRANCH"
else
  echo "Reusing existing worktree: $WORKTREE"
fi

gh issue edit "$ISSUE_NUMBER" --add-label openspec-in-progress >/dev/null
gh issue edit "$ISSUE_NUMBER" --remove-label agent-ready >/dev/null 2>&1 || true

cat <<EOF
Dispatched OpenSpec issue.

Change: $CHANGE_NAME
Issue: #$ISSUE_NUMBER $ISSUE_TITLE
Branch: $BRANCH
Worktree: $WORKTREE

Next:
  cd "$WORKTREE"

Agent prompt:
  Use the openspec-work-issue skill. Implement GitHub issue #$ISSUE_NUMBER for OpenSpec change $CHANGE_NAME.

Rules:
  - Read proposal.md, design.md, tasks.md, and relevant specs.
  - Implement only tasks.md rows that reference #$ISSUE_NUMBER.
  - Mark only those task rows complete.
  - Run relevant verification.
  - Use the ship skill to open the PR with "Closes #$ISSUE_NUMBER".
  - After the PR opens, run caveman-review before asking the user to review.
EOF
