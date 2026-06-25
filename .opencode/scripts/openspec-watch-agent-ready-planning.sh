#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-watch-agent-ready-planning.sh [--once] [--interval seconds]

Polls open GitHub issues created by and assigned to the current GitHub user
with label agent-ready. For each match, spawns an OpenSpec planning worker.

Environment:
  STATE_DIR    Optional state/log dir. Defaults to ~/.opencode/state/<repo-name>.
  ISSUE_LABEL  Optional ready label. Defaults to agent-ready.
  WORKER       Optional worker script path.
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

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
STATE_DIR="${STATE_DIR:-$HOME/.opencode/state/$REPO_NAME}"
LOCK_DIR="$STATE_DIR/openspec-planning-watch.lock.d"
LOG_FILE="$STATE_DIR/openspec-planning-watch.log"
ISSUE_LABEL="${ISSUE_LABEL:-agent-ready}"
WORKER="${WORKER:-$REPO_ROOT/.opencode/scripts/openspec-plan-issue-worker.sh}"
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
      printf '[%s] clearing stale planning watcher lock%s\n' "$(date)" "${lock_pid:+ from pid $lock_pid}" >> "$LOG_FILE"
      rm -rf "$LOCK_DIR"
      mkdir "$LOCK_DIR" 2>/dev/null || return 0
    else
      printf '[%s] planning watcher already running, skipping\n' "$(date)" >> "$LOG_FILE"
      return 0
    fi
  fi
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
  trap 'rm -rf "$LOCK_DIR" 2>/dev/null' RETURN

  local use_osascript current_user issues worker_env
  use_osascript=0
  if command -v osascript >/dev/null 2>&1 && /usr/bin/osascript -e 'id of application "iTerm2"' >/dev/null 2>&1; then
    use_osascript=1
    if ! /usr/bin/osascript -e 'tell application "iTerm2" to if (count of windows) is 0 then create window with default profile' >> "$LOG_FILE" 2>&1; then
      printf '[%s] iTerm unavailable; running workers in background\n' "$(date)" >> "$LOG_FILE"
      use_osascript=0
    fi
  fi

  worker_env="$(env_prefix GH_TOKEN AGENT_GIT_NAME AGENT_GIT_EMAIL OPENCODE_MODEL OPENCODE_RUN_FLAGS STATE_DIR)"

  cd "$REPO_ROOT"
  gh label create "$ISSUE_LABEL" --description "Ready for local opencode agent pickup" --color 5319E7 >/dev/null 2>&1 || true
  current_user="$(gh api user --jq '.login')" || return 1

  issues="$(gh issue list \
    --assignee "@me" \
    --label "$ISSUE_LABEL" \
    --state open \
    --json number,title,author,labels \
    --jq ".[] | select(.author.login == \"$current_user\") | select(([.labels[].name] | index(\"openspec-planning\") or index(\"openspec-review-ready\") or index(\"openspec-apply-ready\") or index(\"openspec-implementing\")) | not) | \"\\(.number)|\\(.title)\"")" || return 1

  if [[ -z "$issues" ]]; then
    return 0
  fi

  while IFS='|' read -r issue_number issue_title; do
    [[ -z "$issue_number" ]] && continue
    printf '[%s] planning dispatch #%s: %s\n' "$(date)" "$issue_number" "$issue_title" >> "$LOG_FILE"

    if [[ "$use_osascript" -eq 1 ]]; then
      /usr/bin/osascript >> "$LOG_FILE" 2>&1 <<OSA || {
tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session
      set name to "openspec-plan-${issue_number}"
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
  if ! tick; then
    printf '[%s] planning watcher tick failed; retrying\n' "$(date)" >> "$LOG_FILE"
  fi
  if [[ "$ONCE" -eq 1 ]]; then
    exit 0
  fi
  sleep "$INTERVAL"
done
