#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-watch-apply-ready.sh [--once] [--interval seconds]

Polls open PRs labeled openspec-apply-ready. For each match, spawns an
OpenSpec apply worker that implements in the same PR branch.

Environment:
  STATE_DIR    Optional state/log dir. Defaults to ~/.opencode/state/<repo-name>.
  PR_LABEL     Optional ready label. Defaults to openspec-apply-ready.
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
LOCK_DIR="$STATE_DIR/openspec-apply-watch.lock.d"
LOG_FILE="$STATE_DIR/openspec-apply-watch.log"
PR_LABEL="${PR_LABEL:-openspec-apply-ready}"
WORKER="${WORKER:-$REPO_ROOT/.opencode/scripts/openspec-apply-pr-worker.sh}"
mkdir -p "$STATE_DIR"

tick() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    local lock_pid
    lock_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [[ -z "$lock_pid" ]] || ! kill -0 "$lock_pid" 2>/dev/null; then
      printf '[%s] clearing stale apply watcher lock%s\n' "$(date)" "${lock_pid:+ from pid $lock_pid}" >> "$LOG_FILE"
      rm -rf "$LOCK_DIR"
      mkdir "$LOCK_DIR" 2>/dev/null || return 0
    else
      printf '[%s] apply watcher already running, skipping\n' "$(date)" >> "$LOG_FILE"
      return 0
    fi
  fi
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
  trap 'rm -rf "$LOCK_DIR" 2>/dev/null' RETURN

  local use_osascript prs
  use_osascript=0
  if command -v osascript >/dev/null 2>&1 && /usr/bin/osascript -e 'id of application "iTerm2"' >/dev/null 2>&1; then
    use_osascript=1
    if ! /usr/bin/osascript -e 'tell application "iTerm2" to if (count of windows) is 0 then create window with default profile' >> "$LOG_FILE" 2>&1; then
      printf '[%s] iTerm unavailable; running workers in background\n' "$(date)" >> "$LOG_FILE"
      use_osascript=0
    fi
  fi

  cd "$REPO_ROOT"
  gh label create "$PR_LABEL" --description "OpenSpec artifact PR is approved for implementation" --color 0E8A16 >/dev/null 2>&1 || true

  prs="$(gh pr list \
    --label "$PR_LABEL" \
    --state open \
    --json number,title,labels \
    --jq '.[] | select(([.labels[].name] | index("openspec-implementing")) | not) | "\(.number)|\(.title)"')"

  if [[ -z "$prs" ]]; then
    return 0
  fi

  while IFS='|' read -r pr_number pr_title; do
    [[ -z "$pr_number" ]] && continue
    printf '[%s] apply dispatch PR #%s: %s\n' "$(date)" "$pr_number" "$pr_title" >> "$LOG_FILE"

    if [[ "$use_osascript" -eq 1 ]]; then
      /usr/bin/osascript >> "$LOG_FILE" 2>&1 <<OSA || {
tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session
      set name to "openspec-apply-${pr_number}"
      write text "cd \"$REPO_ROOT\" && \"$WORKER\" $pr_number"
    end tell
  end tell
end tell
OSA
        printf '[%s] iTerm spawn failed for PR #%s; running worker in background\n' "$(date)" "$pr_number" >> "$LOG_FILE"
        (cd "$REPO_ROOT" && "$WORKER" "$pr_number" >> "$LOG_FILE" 2>&1 &)
      }
    else
      (cd "$REPO_ROOT" && "$WORKER" "$pr_number" >> "$LOG_FILE" 2>&1 &)
    fi
  done <<< "$prs"
}

while true; do
  tick
  if [[ "$ONCE" -eq 1 ]]; then
    exit 0
  fi
  sleep "$INTERVAL"
done
