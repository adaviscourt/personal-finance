#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-watch-pr-feedback.sh [--once] [--interval seconds]

Polls open PRs labeled agent-feedback-ready. If unprocessed comments or review
comments mention @H-E-L-P-eR, spawns a feedback worker for the same PR branch.

Environment:
  STATE_DIR         Optional state/log dir. Defaults to ~/.opencode/state/<repo-name>.
  PR_LABEL          Optional watch label. Defaults to agent-feedback-ready.
  FEEDBACK_TRIGGER  Optional comment mention/text. Defaults to @H-E-L-P-eR.
  FEEDBACK_AUTHOR   Optional GitHub login allowed to trigger feedback. Defaults to current gh user.
  GH_TOKEN          Optional bot/machine token; determines GitHub comment/reaction actor.
  AGENT_LOOP_SANDBOX Optional sandbox mode passed to workers. Set to docker.
  WORKER            Optional worker script path.
  DEBOUNCE_SECONDS  Optional quiet period before processing. Defaults to 300.
  PR_LOCK_STALE_SECONDS Optional stale PR lock age. Defaults to 300.
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

REQUIRED_CMDS=(gh git jq)
if [[ "${AGENT_LOOP_SANDBOX:-}" == "docker" ]]; then
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

REPO_ROOT="$(git rev-parse --show-toplevel)"
GIT_COMMON_DIR="$(git rev-parse --git-common-dir)"
if [[ "$GIT_COMMON_DIR" != /* ]]; then
  GIT_COMMON_DIR="$REPO_ROOT/$GIT_COMMON_DIR"
fi
if [[ "$(basename "$GIT_COMMON_DIR")" == ".git" ]]; then
  REPO_NAME="$(basename "$(dirname "$GIT_COMMON_DIR")")"
else
  REPO_NAME="$(basename "$REPO_ROOT")"
fi
STATE_DIR="${STATE_DIR:-$HOME/.opencode/state/$REPO_NAME}"
LOCK_DIR="$STATE_DIR/openspec-feedback-watch.lock.d"
LOG_FILE="$STATE_DIR/openspec-feedback-watch.log"
PR_LABEL="${PR_LABEL:-agent-feedback-ready}"
FEEDBACK_TRIGGER="${FEEDBACK_TRIGGER:-@H-E-L-P-eR}"
FEEDBACK_AUTHOR="${FEEDBACK_AUTHOR:-}"
WORKER="${WORKER:-$REPO_ROOT/.opencode/scripts/openspec-pr-feedback-worker.sh}"
DEBOUNCE_SECONDS="${DEBOUNCE_SECONDS:-300}"
PR_LOCK_STALE_SECONDS="${PR_LOCK_STALE_SECONDS:-300}"
mkdir -p "$STATE_DIR"

resolve_feedback_author() {
  if [[ -n "$FEEDBACK_AUTHOR" ]]; then
    FEEDBACK_AUTHOR="${FEEDBACK_AUTHOR#@}"
    return 0
  fi
  FEEDBACK_AUTHOR="$(gh api user --jq '.login')" || return 1
}

env_prefix() {
  local out="" var
  for var in "$@"; do
    if [[ -n "${!var+x}" ]]; then
      printf -v out '%s%s=%q ' "$out" "$var" "${!var}"
    fi
  done
  printf '%s' "$out"
}

iso_to_epoch() {
  date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$1" +%s 2>/dev/null \
    || date -u -d "$1" +%s 2>/dev/null \
    || echo 0
}

has_unprocessed_feedback() {
  local pr_number="$1" processed_file="$STATE_DIR/pr-${pr_number}-opencode-feedback-processed.txt"
  touch "$processed_file"
  local processed_json issue_json inline_json reviews_json newest_ts count
  processed_json="$(jq -R -s 'split("\n") | map(select(length > 0))' "$processed_file")"
  issue_json="$(gh api "repos/:owner/:repo/issues/${pr_number}/comments?per_page=100" 2>/dev/null || printf '[]')"
  inline_json="$(gh api "repos/:owner/:repo/pulls/${pr_number}/comments?per_page=100" 2>/dev/null || printf '[]')"
  reviews_json="$(gh api "repos/:owner/:repo/pulls/${pr_number}/reviews?per_page=100" 2>/dev/null || printf '[]')"

  count="$(
    {
      jq -r --argjson done "$processed_json" --arg trigger "$FEEDBACK_TRIGGER" --arg author "$FEEDBACK_AUTHOR" '.[] | select(.user.login == $author) | select((.body // "") | contains($trigger)) | "issue-comment:" + (.id|tostring) as $key | select(($done | index($key)) | not) | $key' <<< "$issue_json"
      jq -r --argjson done "$processed_json" --arg trigger "$FEEDBACK_TRIGGER" --arg author "$FEEDBACK_AUTHOR" '.[] | select(.user.login == $author) | select((.body // "") | contains($trigger)) | "inline-comment:" + (.id|tostring) as $key | select(($done | index($key)) | not) | $key' <<< "$inline_json"
      jq -r --argjson done "$processed_json" --arg trigger "$FEEDBACK_TRIGGER" --arg author "$FEEDBACK_AUTHOR" '.[] | select(.user.login == $author) | select((.body // "") | contains($trigger)) | "review:" + (.id|tostring) as $key | select(($done | index($key)) | not) | $key' <<< "$reviews_json"
    } | sed '/^$/d' | wc -l | tr -d ' '
  )"
  [[ "$count" -gt 0 ]] || return 1

  newest_ts="$(
    {
      jq -r --argjson done "$processed_json" --arg trigger "$FEEDBACK_TRIGGER" --arg author "$FEEDBACK_AUTHOR" '.[] | select(.user.login == $author) | select((.body // "") | contains($trigger)) | "issue-comment:" + (.id|tostring) as $key | select(($done | index($key)) | not) | .created_at' <<< "$issue_json"
      jq -r --argjson done "$processed_json" --arg trigger "$FEEDBACK_TRIGGER" --arg author "$FEEDBACK_AUTHOR" '.[] | select(.user.login == $author) | select((.body // "") | contains($trigger)) | "inline-comment:" + (.id|tostring) as $key | select(($done | index($key)) | not) | .created_at' <<< "$inline_json"
      jq -r --argjson done "$processed_json" --arg trigger "$FEEDBACK_TRIGGER" --arg author "$FEEDBACK_AUTHOR" '.[] | select(.user.login == $author) | select((.body // "") | contains($trigger)) | "review:" + (.id|tostring) as $key | select(($done | index($key)) | not) | .submitted_at' <<< "$reviews_json"
    } | sort -r | head -n 1
  )"
  [[ -n "$newest_ts" ]] || return 1

  local now_epoch newest_epoch
  now_epoch="$(date +%s)"
  newest_epoch="$(iso_to_epoch "$newest_ts")"
  if (( now_epoch - newest_epoch < DEBOUNCE_SECONDS )); then
    printf '[%s] PR #%s: feedback debouncing (%ss old)\n' "$(date)" "$pr_number" "$((now_epoch - newest_epoch))" >> "$LOG_FILE"
    return 1
  fi
  return 0
}

lock_age_seconds() {
  local path="$1" mtime now
  mtime="$(stat -f %m "$path" 2>/dev/null || stat -c %Y "$path" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  echo "$((now - mtime))"
}

pr_lock_is_stale() {
  local pr_number="$1" pr_lock="$2" pid age
  age="$(lock_age_seconds "$pr_lock")"
  pid="$(cat "$pr_lock/pid" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    (( age >= PR_LOCK_STALE_SECONDS ))
    return
  fi

  if kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  if (( age >= PR_LOCK_STALE_SECONDS )); then
    printf '[%s] clearing stale feedback PR #%s lock from pid %s\n' "$(date)" "$pr_number" "$pid" >> "$LOG_FILE"
    return 0
  fi

  return 1
}

tick() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    local lock_pid
    lock_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [[ -z "$lock_pid" ]] || ! kill -0 "$lock_pid" 2>/dev/null; then
      printf '[%s] clearing stale feedback watcher lock%s\n' "$(date)" "${lock_pid:+ from pid $lock_pid}" >> "$LOG_FILE"
      rm -rf "$LOCK_DIR"
      mkdir "$LOCK_DIR" 2>/dev/null || return 0
    else
      printf '[%s] feedback watcher already running, skipping\n' "$(date)" >> "$LOG_FILE"
      return 0
    fi
  fi
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
  trap 'rm -rf "$LOCK_DIR" 2>/dev/null' RETURN

  local use_osascript prs worker_env
  use_osascript=0
  if command -v osascript >/dev/null 2>&1 && /usr/bin/osascript -e 'id of application "iTerm2"' >/dev/null 2>&1; then
    use_osascript=1
    if ! /usr/bin/osascript -e 'tell application "iTerm2" to if (count of windows) is 0 then create window with default profile' >> "$LOG_FILE" 2>&1; then
      printf '[%s] iTerm unavailable; running workers in background\n' "$(date)" >> "$LOG_FILE"
      use_osascript=0
    fi
  fi

  cd "$REPO_ROOT"
  resolve_feedback_author || return 1
  worker_env="$(env_prefix GH_TOKEN AGENT_GIT_NAME AGENT_GIT_EMAIL AGENT_LOOP_SANDBOX OPENCODE_MODEL OPENCODE_RUN_FLAGS STATE_DIR PR_LOCK_STALE_SECONDS DEBOUNCE_SECONDS FEEDBACK_TRIGGER FEEDBACK_AUTHOR PR_LABEL)"
  gh label create "$PR_LABEL" --description "PR feedback may be handled by opencode" --color D4C5F9 >/dev/null 2>&1 || true

  prs="$(gh pr list \
    --label "$PR_LABEL" \
    --state open \
    --json number,title,labels \
    --jq '.[] | select(([.labels[].name] | index("openspec-implementing")) | not) | "\(.number)|\(.title)"')" || return 1

  if [[ -z "$prs" ]]; then
    return 0
  fi

  while IFS='|' read -r pr_number pr_title; do
    [[ -z "$pr_number" ]] && continue
    local pr_lock="$STATE_DIR/pr-${pr_number}-feedback.lock.d"
    if [[ -d "$pr_lock" ]]; then
      if pr_lock_is_stale "$pr_number" "$pr_lock"; then
        rm -rf "$pr_lock"
      else
        continue
      fi
    fi
    has_unprocessed_feedback "$pr_number" || continue
    mkdir "$pr_lock" 2>/dev/null || continue

    printf '[%s] feedback dispatch PR #%s: %s\n' "$(date)" "$pr_number" "$pr_title" >> "$LOG_FILE"

    if [[ "$use_osascript" -eq 1 ]]; then
      /usr/bin/osascript >> "$LOG_FILE" 2>&1 <<OSA || {
tell application "iTerm2"
  tell current window
    create tab with default profile
    tell current session
      set name to "openspec-feedback-${pr_number}"
      write text "cd \"$REPO_ROOT\" && printf '%s\\n' \$\$ > \"$pr_lock/pid\" && ${worker_env}\"$WORKER\" $pr_number; rc=\$?; rm -rf \"$pr_lock\" 2>/dev/null || true; exit \$rc"
    end tell
  end tell
end tell
OSA
        printf '[%s] iTerm spawn failed for PR #%s; running worker in background\n' "$(date)" "$pr_number" >> "$LOG_FILE"
        (cd "$REPO_ROOT" && printf '%s\n' "$BASHPID" > "$pr_lock/pid" && trap 'rm -rf "$pr_lock" 2>/dev/null || true' EXIT && STATE_DIR="$STATE_DIR" "$WORKER" "$pr_number" >> "$LOG_FILE" 2>&1) &
      }
    else
      (cd "$REPO_ROOT" && printf '%s\n' "$BASHPID" > "$pr_lock/pid" && trap 'rm -rf "$pr_lock" 2>/dev/null || true' EXIT && STATE_DIR="$STATE_DIR" "$WORKER" "$pr_number" >> "$LOG_FILE" 2>&1) &
    fi
  done <<< "$prs"
}

while true; do
  if ! tick; then
    printf '[%s] feedback watcher tick failed; retrying\n' "$(date)" >> "$LOG_FILE"
  fi
  if [[ "$ONCE" -eq 1 ]]; then
    exit 0
  fi
  sleep "$INTERVAL"
done
