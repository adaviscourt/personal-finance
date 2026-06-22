#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-agent-loop-tick.sh

Runs one local OpenSpec agent loop tick:
  1. raw issue planning pickup (agent-ready)
  2. same-PR implementation pickup (openspec-apply-ready)
  3. same-PR @opencode feedback pickup (agent-feedback-ready)

Environment:
  STATE_DIR  Optional state/log dir. Defaults to ~/.opencode/state/<repo-name>.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Must be run inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
STATE_DIR="${STATE_DIR:-$HOME/.opencode/state/$REPO_NAME}"
LOG_FILE="$STATE_DIR/openspec-agent-loop-tick.log"
mkdir -p "$STATE_DIR"

date +%s > "$STATE_DIR/openspec-agent-loop.heartbeat"

cd "$REPO_ROOT"

{
  printf '[%s] tick start\n' "$(date)"
  .opencode/scripts/openspec-watch-agent-ready-planning.sh --once
  .opencode/scripts/openspec-watch-apply-ready.sh --once
  .opencode/scripts/openspec-watch-pr-feedback.sh --once
  printf '[%s] tick end\n' "$(date)"
} >> "$LOG_FILE" 2>&1
