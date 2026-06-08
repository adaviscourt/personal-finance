#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  .opencode/scripts/openspec-agent-ready-worker.sh <issue-number>

Dispatches one agent-ready GitHub issue into an OpenSpec worktree, then runs
opencode unattended in that worktree using the openspec-work-issue skill.

Environment:
  OPENCODE_MODEL       Optional model override, e.g. openai/gpt-5.5.
  OPENCODE_RUN_FLAGS   Optional extra flags passed to opencode run.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
  usage
  exit 1
fi

ISSUE_NUMBER="${1#\#}"

if ! command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI is required and was not found." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required and was not found." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required and was not found." >&2
  exit 1
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Must be run inside a git repository." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DISPATCH_OUTPUT="$(.opencode/scripts/openspec-dispatch-issue.sh "$ISSUE_NUMBER")"
printf '%s\n' "$DISPATCH_OUTPUT"

WORKTREE="$(printf '%s\n' "$DISPATCH_OUTPUT" | sed -nE 's/^Worktree:[[:space:]]*(.*)$/\1/p' | tail -n 1)"
CHANGE_NAME="$(printf '%s\n' "$DISPATCH_OUTPUT" | sed -nE 's/^Change:[[:space:]]*(.*)$/\1/p' | tail -n 1)"

if [[ -z "$WORKTREE" || ! -d "$WORKTREE" ]]; then
  echo "Could not determine dispatched worktree for issue #$ISSUE_NUMBER." >&2
  exit 1
fi

ISSUE_JSON="$(gh issue view "$ISSUE_NUMBER" --json title,url,body,comments,labels)"
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

PROMPT="$(cat <<EOF
Use the openspec-work-issue skill. Implement GitHub issue #${ISSUE_NUMBER} for OpenSpec change ${CHANGE_NAME}.

Issue: ${ISSUE_TITLE}
URL: ${ISSUE_URL}

Issue body:
---
${ISSUE_BODY}
---

Issue comments:
---
${ISSUE_COMMENTS}
---

Run unattended but self-enforce these rules:
- Work only in this issue worktree: ${WORKTREE}
- Read proposal.md, design.md, tasks.md, and relevant specs before editing.
- Confirm proposal approval.
- Implement only tasks.md rows that reference #${ISSUE_NUMBER}.
- Mark only those tasks.md rows complete.
- Run relevant verification and openspec status for ${CHANGE_NAME}.
- Use the ship skill to commit, push, and open a PR.
- PR body must include "Closes #${ISSUE_NUMBER}" and exact tasks.md rows completed.
- After PR opens, run caveman-review before asking user to review.
- If blocked or scope must change, stop and report. Do not archive the OpenSpec change.
EOF
)"

RUN_ARGS=(run --dir "$WORKTREE" --title "openspec-issue-${ISSUE_NUMBER}" --dangerously-skip-permissions)
if [[ -n "${OPENCODE_MODEL:-}" ]]; then
  RUN_ARGS+=(--model "$OPENCODE_MODEL")
fi
if [[ -n "${OPENCODE_RUN_FLAGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_FLAGS=(${OPENCODE_RUN_FLAGS})
  RUN_ARGS+=("${EXTRA_FLAGS[@]}")
fi

exec opencode "${RUN_ARGS[@]}" "$PROMPT"
