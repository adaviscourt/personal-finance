#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-agent-loop-watch.sh [--interval seconds]

Runs all local OpenSpec agent loop watchers in one foreground supervisor:
  - issue planning watcher (agent-ready)
  - same-PR apply watcher (openspec-apply-ready)
  - same-PR feedback watcher (agent-feedback-ready + @opencode)

Stop with Ctrl-C. Child watchers are terminated together.

Environment:
  STATE_DIR  Optional state/log dir. Defaults to ~/.opencode/state/<repo-name>.
USAGE
}

INTERVAL=60

while [[ $# -gt 0 ]]; do
  case "$1" in
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

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Must be run inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
STATE_DIR="${STATE_DIR:-$HOME/.opencode/state/$REPO_NAME}"
LOG_FILE="$STATE_DIR/openspec-agent-loop-watch.log"
mkdir -p "$STATE_DIR"

PIDS=()

cleanup() {
  local pid
  trap - INT TERM EXIT
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

start_watcher() {
  local name="$1" script="$2"
  printf '[%s] starting %s\n' "$(date)" "$name" | tee -a "$LOG_FILE"
  "$script" --interval "$INTERVAL" >> "$LOG_FILE" 2>&1 &
  PIDS+=("$!")
}

trap cleanup INT TERM EXIT

cd "$REPO_ROOT"
date +%s > "$STATE_DIR/openspec-agent-loop-watch.heartbeat"

start_watcher planning ".opencode/scripts/openspec-watch-agent-ready-planning.sh"
start_watcher apply ".opencode/scripts/openspec-watch-apply-ready.sh"
start_watcher feedback ".opencode/scripts/openspec-watch-pr-feedback.sh"

printf 'OpenSpec agent loop watchers running. Logs: %s\n' "$LOG_FILE"
printf 'Stop with Ctrl-C.\n'

while true; do
  date +%s > "$STATE_DIR/openspec-agent-loop-watch.heartbeat"
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      printf '[%s] watcher pid %s exited; stopping supervisor\n' "$(date)" "$pid" | tee -a "$LOG_FILE"
      exit 1
    fi
  done
  sleep 30
done
