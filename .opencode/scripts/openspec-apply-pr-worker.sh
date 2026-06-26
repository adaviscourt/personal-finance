#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-apply-pr-worker.sh <pr-number>

Checks out an OpenSpec artifact PR into its same branch worktree, then runs
opencode unattended to implement the change in that same PR.

Environment:
  WORKTREE_BASE       Optional parent directory for worktrees/clones.
  GH_TOKEN            Optional bot/machine token; determines GitHub PR/comment/label actor.
  AGENT_GIT_NAME      Optional git user.name configured in the implementation worktree.
  AGENT_GIT_EMAIL     Optional git user.email configured in the implementation worktree.
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
    sandbox_name="openspec-apply-${PR_NUMBER}-$(date +%Y%m%d%H%M%S)"
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
    OPENCODE_AGENT_LOOP_PHASE="implementation" \
    OPENCODE_AGENT_LOOP_PR="$PR_NUMBER" \
    OPENCODE_AGENT_LOOP_BRANCH="$BRANCH" \
    opencode "${RUN_ARGS[@]}" "$PROMPT"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 1
fi

PR_NUMBER="${1#\#}"

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

prepare_checkout "$BRANCH" "$DEFAULT_BRANCH" head

cd "$WORKTREE"
configure_git_identity
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
Implement OpenSpec change ${CHANGE_NAME} in this same PR branch.

Run unattended and self-enforce these rules:
- Work only in the worktree named below.
- Read proposal.md, design.md, tasks.md, and relevant specs for the change before editing application code.
- Confirm artifacts are coherent and apply-ready before implementation.
- Implement the tasks in openspec/changes/${CHANGE_NAME}/tasks.md.
- Keep scope to the approved OpenSpec artifacts. If implementation reveals scope change, stop and report instead of silently expanding.
- Mark completed tasks in tasks.md.
- Run relevant verification and openspec status for the change.
- Commit, push, and update this same PR branch using git and gh.
- PR body must mention the OpenSpec change and exact tasks completed.
- After implementation is complete, PR body should include Closes #<issue> when an original issue is provided.
- Keep label agent-feedback-ready on the PR so @H-E-L-P-eR feedback can be handled.
- Do not archive the OpenSpec change.

PR: ${PR_TITLE}
URL: ${PR_URL}
PR number: #${PR_NUMBER}
Branch: ${BRANCH}
Worktree: ${WORKTREE}
${ISSUE_NUMBER:+Original issue: #${ISSUE_NUMBER}}
EOF
)"

METRICS_FILE="$STATE_DIR/agent-loop-metrics-apply-pr-${PR_NUMBER}-$(date +%Y%m%d%H%M%S).json"
RUN_ARGS=(run --dir "$WORKTREE" --agent openspec-implementer --title "openspec-apply-pr-${PR_NUMBER}" --dangerously-skip-permissions)
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
  gh api "repos/:owner/:repo/issues/${PR_NUMBER}/labels" --method POST -f "labels[]=agent-blocked" >/dev/null 2>&1 || true
  exit "$AGENT_RC"
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
  "$REPO_ROOT/.opencode/scripts/openspec-post-agent-loop-metrics.sh" "$PR_NUMBER" "$METRICS_FILE" || true

printf 'OpenSpec implementation complete for PR #%s.\n' "$PR_NUMBER"
