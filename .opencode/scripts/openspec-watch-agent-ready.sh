#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-watch-agent-ready.sh [--once] [--interval seconds]

Polls open GitHub issues for label agent-ready. For each match, spawns an
opencode worker that dispatches the issue into an OpenSpec worktree and runs
the openspec-work-issue process.

Environment:
  STATE_DIR       Optional state/log dir. Defaults to ~/.opencode/state/personal-finance.
  ASSIGNEE        Optional assignee filter. Defaults to @me.
  ISSUE_LABEL     Optional ready label. Defaults to agent-ready.
  WORKER          Optional worker script path.
USAGE
}

ONCE=0
INTERVAL=60

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once)
      ONCE=1
      shift
      ;;
    --interval)
      INTERVAL="${2:-}"
      if [[ -z "$INTERVAL" ]]; then
        usage
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required and was not found." >&2
  exit 1
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI is required and was not found." >&2
  exit 1
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Must be run inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
STATE_DIR="${STATE_DIR:-$HOME/.opencode/state/$REPO_NAME}"
LOCK_DIR="$STATE_DIR/openspec-agent-ready.lock.d"
LOG_FILE="$STATE_DIR/openspec-agent-ready.log"
ISSUE_LABEL="${ISSUE_LABEL:-agent-ready}"
ASSIGNEE="${ASSIGNEE:-@me}"
WORKER="${WORKER:-$REPO_ROOT/.opencode/scripts/openspec-agent-ready-worker.sh}"

mkdir -p "$STATE_DIR"

env_prefix() {
  local out="" var
  for var in "$@"; do
    if [[ -n "${!var+x}" ]]; then
      printf -v out '%s%s=%q ' "$out" "$var" "${!var}"
    fi
  done
  printf '%s' "$out"
}

tick() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    local lock_pid
    lock_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [[ -z "$lock_pid" ]] || ! kill -0 "$lock_pid" 2>/dev/null; then
      printf '[%s] clearing stale watcher lock%s\n' "$(date)" "${lock_pid:+ from pid $lock_pid}" >> "$LOG_FILE"
      rm -rf "$LOCK_DIR"
      if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        printf '[%s] watcher lock race, skipping\n' "$(date)" >> "$LOG_FILE"
        return 0
      fi
    else
      printf '[%s] watcher already running, skipping\n' "$(date)" >> "$LOG_FILE"
      return 0
    fi
  fi
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
  trap 'rm -rf "$LOCK_DIR" 2>/dev/null' RETURN

  local use_osascript worker_env
  use_osascript=0
  if command -v osascript >/dev/null 2>&1 && /usr/bin/osascript -e 'id of application "iTerm2"' >/dev/null 2>&1; then
    use_osascript=1
    if ! /usr/bin/osascript -e 'tell application "iTerm2" to if (count of windows) is 0 then create window with default profile' >> "$LOG_FILE" 2>&1; then
      printf '[%s] iTerm unavailable; running workers in background\n' "$(date)" >> "$LOG_FILE"
      use_osascript=0
    fi
  fi

  worker_env="$(env_prefix GH_TOKEN AGENT_GIT_NAME AGENT_GIT_EMAIL OPENCODE_MODEL OPENCODE_RUN_FLAGS STATE_DIR ASSIGNEE)"

  cd "$REPO_ROOT"
  gh label create "$ISSUE_LABEL" --description "Ready for local opencode agent pickup" --color 5319E7 >/dev/null 2>&1 || true

  local issues
  issues="$(gh issue list \
    --assignee "$ASSIGNEE" \
    --label "$ISSUE_LABEL" \
    --state open \
    --json number,title,labels \
    --jq '.[] | select(([.labels[].name] | index("openspec-in-progress")) | not) | "\(.number)|\(.title)"')"

  if [[ -z "$issues" ]]; then
    return 0
  fi

  while IFS='|' read -r issue_number issue_title; do
    [[ -z "$issue_number" ]] && continue
    printf '[%s] dispatching #%s: %s\n' "$(date)" "$issue_number" "$issue_title" >> "$LOG_FILE"

    if [[ "$use_osascript" -eq 1 ]]; then
      /usr/bin/osascript >> "$LOG_FILE" 2>&1 <<OSA || {
tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session
      set name to "openspec-issue-${issue_number}"
      write text "cd \"$REPO_ROOT\" && ${worker_env}\"$WORKER\" $issue_number"
    end tell
  end tell
end tell
OSA
        printf '[%s] iTerm spawn failed for #%s; running worker in background\n' "$(date)" "$issue_number" >> "$LOG_FILE"
        (cd "$REPO_ROOT" && "$WORKER" "$issue_number" >> "$LOG_FILE" 2>&1 &)
      }
    else
      (cd "$REPO_ROOT" && "$WORKER" "$issue_number" >> "$LOG_FILE" 2>&1 &)
    fi
  done <<< "$issues"
}

while true; do
  tick
  if [[ "$ONCE" -eq 1 ]]; then
    exit 0
  fi
  sleep "$INTERVAL"
done
