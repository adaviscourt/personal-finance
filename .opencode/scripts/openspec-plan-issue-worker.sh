#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-plan-issue-worker.sh <issue-number>

Creates or reuses a planning worktree for one raw GitHub issue, then runs
opencode unattended to create OpenSpec artifacts and open a same-PR planning PR.

Environment:
  WORKTREE_BASE       Optional parent directory for worktrees/clones.
  GH_TOKEN            Optional bot/machine token; determines GitHub PR/comment/label actor.
  AGENT_GIT_NAME      Optional git user.name configured in the planning worktree.
  AGENT_GIT_EMAIL     Optional git user.email configured in the planning worktree.
  AGENT_LOOP_SANDBOX  Optional sandbox mode. Set to docker to run via Docker sbx.
  AGENT_LOOP_SANDBOX_AGENT Optional sbx agent in docker mode. Defaults to codex; set opencode to restore old path.
  OPENCODE_MODEL      Optional model override, e.g. openai/gpt-5.5.
  OPENCODE_RUN_FLAGS  Optional extra flags passed to opencode run.
  CODEX_MODEL         Optional Codex model override in docker mode.
  CODEX_EXEC_FLAGS    Optional extra flags passed to codex exec in docker mode.
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

configure_git_identity() {
  if [[ -n "${AGENT_GIT_NAME:-}" ]]; then
    git config user.name "$AGENT_GIT_NAME"
  fi
  if [[ -n "${AGENT_GIT_EMAIL:-}" ]]; then
    git config user.email "$AGENT_GIT_EMAIL"
  fi
}

use_docker_sandbox() {
  [[ "${AGENT_LOOP_SANDBOX:-}" == "docker" ]]
}

prepare_checkout() {
  local branch="$1" default_branch="$2" source_ref="$3"

  if use_docker_sandbox; then
    local remote_url checkout_ref
    remote_url="$(git config --get remote.origin.url)"
    if [[ -z "$remote_url" ]]; then
      echo "remote.origin.url is required for AGENT_LOOP_SANDBOX=docker." >&2
      exit 1
    fi

    if [[ -e "$WORKTREE" && ! -d "$WORKTREE/.git" ]]; then
      echo "Docker sandbox mode requires a standalone clone, but $WORKTREE already exists and is not one." >&2
      exit 1
    fi

    if [[ ! -d "$WORKTREE/.git" ]]; then
      git clone --quiet "$remote_url" "$WORKTREE"
    else
      echo "Reusing existing clone: $WORKTREE"
    fi

    (
      cd "$WORKTREE"
      git fetch origin "$default_branch" --quiet
      git fetch origin "$branch" --quiet 2>/dev/null || true
      checkout_ref="origin/$default_branch"
      if [[ "$source_ref" == "head" ]] && git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
        checkout_ref="origin/$branch"
      fi
      git checkout -B "$branch" "$checkout_ref" --quiet
    )
  elif [[ ! -d "$WORKTREE" ]]; then
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      git worktree add "$WORKTREE" "$branch"
    else
      git worktree add -b "$branch" "$WORKTREE" "origin/$default_branch"
    fi
  else
    echo "Reusing existing worktree: $WORKTREE"
  fi
}

run_agent() {
  if use_docker_sandbox; then
    local sandbox_name kit_path sandbox_agent
    if ! command -v sbx >/dev/null 2>&1; then
      echo "sbx is required when AGENT_LOOP_SANDBOX=docker." >&2
      return 1
    fi
    sandbox_name="openspec-plan-${ISSUE_NUMBER}-$(date +%Y%m%d%H%M%S)"
    kit_path="$REPO_ROOT/.opencode/sandbox-kits/agent-loop"
    sandbox_agent="${AGENT_LOOP_SANDBOX_AGENT:-codex}"
    case "$sandbox_agent" in
      codex)
        sbx run codex --name "$sandbox_name" --kit "$kit_path" "$WORKTREE" "$STATE_DIR" -- "${CODEX_RUN_ARGS[@]}" "$PROMPT"
        ;;
      opencode)
        sbx run opencode --name "$sandbox_name" --kit "$kit_path" "$WORKTREE" "$STATE_DIR" -- "${RUN_ARGS[@]}" "$PROMPT"
        ;;
      *)
        echo "Unsupported AGENT_LOOP_SANDBOX_AGENT: $sandbox_agent" >&2
        return 1
        ;;
    esac
  else
    OPENCODE_AGENT_LOOP_METRICS_FILE="$METRICS_FILE" \
    OPENCODE_AGENT_LOOP_PHASE="planning" \
    OPENCODE_AGENT_LOOP_BRANCH="$BRANCH" \
    opencode "${RUN_ARGS[@]}" "$PROMPT"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 1
fi

ISSUE_NUMBER="${1#\#}"

REQUIRED_CMDS=(gh git jq)
if use_docker_sandbox; then
  REQUIRED_CMDS+=(sbx)
else
  REQUIRED_CMDS+=(opencode)
fi

for cmd in "${REQUIRED_CMDS[@]}"; do
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
if [[ -z "${WORKTREE_BASE+x}" ]]; then
  if use_docker_sandbox; then
    WORKTREE_BASE="$(dirname "$REPO_ROOT")/${REPO_NAME}-sandbox-clones"
  else
    WORKTREE_BASE="$(dirname "$REPO_ROOT")/${REPO_NAME}-worktrees"
  fi
fi
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

prepare_checkout "$BRANCH" "$DEFAULT_BRANCH" base

cd "$WORKTREE"
configure_git_identity
cd "$REPO_ROOT"

gh issue edit "$ISSUE_NUMBER" --remove-label agent-ready >/dev/null 2>&1 || true
gh issue edit "$ISSUE_NUMBER" --add-label openspec-planning >/dev/null

PROMPT="$(cat <<EOF
Create OpenSpec artifacts from GitHub issue #${ISSUE_NUMBER}.

Run unattended and self-enforce these rules:
- Work only in the planning worktree named below.
- Create OpenSpec artifacts for the suggested change name unless a better kebab-case name is clearly required by the issue.
- Create proposal, specs, design when useful, and tasks under openspec/changes/<change-name>/.
- Do not implement application code in this planning phase except generated OpenSpec artifacts and minimal issue/PR metadata edits.
- Run OpenSpec validation/status checks after creating artifacts.
- Commit, push, and open a PR from this same branch using git and gh.
- PR title should make clear this is OpenSpec planning.
- PR body must include Refs #${ISSUE_NUMBER} and must not include Closes #${ISSUE_NUMBER} yet.
- PR body must explain that adding label openspec-apply-ready to this PR authorizes implementation in the same PR.
- Add PR label openspec-review-ready if possible.
- If blocked or scope is unclear, stop and report. Do not invent broad implementation scope.

Issue: ${ISSUE_TITLE}
URL: ${ISSUE_URL}
Suggested change name: ${CHANGE_NAME}
Planning worktree: ${WORKTREE}

Issue body:
---
${ISSUE_BODY}
---

Issue comments:
---
${ISSUE_COMMENTS}
---
EOF
)"

METRICS_FILE="$STATE_DIR/agent-loop-metrics-plan-issue-${ISSUE_NUMBER}-$(date +%Y%m%d%H%M%S).json"
RUN_ARGS=(run --dir "$WORKTREE" --agent openspec-planner --title "openspec-plan-issue-${ISSUE_NUMBER}" --dangerously-skip-permissions)
if [[ -n "${OPENCODE_MODEL:-}" ]]; then
  RUN_ARGS+=(--model "$OPENCODE_MODEL")
fi
if [[ -n "${OPENCODE_RUN_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_FLAGS=(${OPENCODE_RUN_FLAGS})
  RUN_ARGS+=("${EXTRA_FLAGS[@]}")
fi
CODEX_RUN_ARGS=(exec --cd "$WORKTREE" --ask-for-approval never --sandbox danger-full-access)
if [[ -n "${CODEX_MODEL:-}" ]]; then
  CODEX_RUN_ARGS+=(--model "$CODEX_MODEL")
fi
if [[ -n "${CODEX_EXEC_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_FLAGS=(${CODEX_EXEC_FLAGS})
  CODEX_RUN_ARGS+=("${EXTRA_FLAGS[@]}")
fi

set +e
run_agent
AGENT_RC=$?
set -e

if [[ "$AGENT_RC" -ne 0 ]]; then
  gh issue edit "$ISSUE_NUMBER" --add-label agent-blocked >/dev/null 2>&1 || true
  exit "$AGENT_RC"
fi

PR_JSON="$(gh pr list --head "$BRANCH" --state open --json number,url --jq '.[0] // empty')"
if [[ -n "$PR_JSON" ]]; then
  PR_NUMBER="$(printf '%s' "$PR_JSON" | jq -r '.number')"
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=openspec-review-ready" >/dev/null 2>&1 || true
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-feedback-ready" >/dev/null 2>&1 || true
  "$REPO_ROOT/.opencode/scripts/openspec-post-agent-loop-metrics.sh" "$PR_NUMBER" "$METRICS_FILE" || true
fi

gh issue edit "$ISSUE_NUMBER" --remove-label openspec-planning >/dev/null 2>&1 || true
gh issue edit "$ISSUE_NUMBER" --add-label openspec-review-ready >/dev/null 2>&1 || true

printf 'OpenSpec planning complete for issue #%s.\n' "$ISSUE_NUMBER"
