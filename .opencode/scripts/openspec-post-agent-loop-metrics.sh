#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${1:-}" || -z "${2:-}" ]]; then
  echo "Usage: .opencode/scripts/openspec-post-agent-loop-metrics.sh <pr-number> <metrics-json>" >&2
  exit 1
fi

PR_NUMBER="${1#\#}"
METRICS_FILE="$2"

for cmd in gh jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required and was not found." >&2
    exit 1
  fi
done

if [[ ! -s "$METRICS_FILE" ]]; then
  echo "No metrics file found: $METRICS_FILE" >&2
  exit 0
fi

BODY="$(jq -r '
  def fmt_ms($ms):
    if ($ms // 0) < 1000 then "\($ms // 0)ms"
    elif ($ms // 0) < 60000 then "\(((($ms // 0) / 1000) * 10 | round) / 10)s"
    else "\(((($ms // 0) / 60000) * 10 | round) / 10)m" end;
  def top($obj):
    ($obj // {})
    | to_entries
    | sort_by(-.value.count, -.value.ms)
    | .[:8]
    | if length == 0 then "_none captured_" else map("- `\(.key)`: \(.value.count)x, ok \(.value.success), fail \(.value.failed), " + fmt_ms(.value.ms)) | join("\n") end;
  def total_tokens: ((.tokens.input // 0) + (.tokens.output // 0) + (.tokens.reasoning // 0) + (.tokens.cache.read // 0) + (.tokens.cache.write // 0));
  "<!-- opencode-agent-loop-metrics -->\n" +
  "### opencode agent metrics\n\n" +
  "| metric | value |\n| --- | ---: |\n" +
  "| phase | `\(.phase // "unknown")` |\n" +
  "| elapsed | " + fmt_ms(.elapsedMs) + " |\n" +
  "| model steps | \(.steps // 0) |\n" +
  "| estimated cost | $\(((.cost // 0) * 10000 | round) / 10000) |\n" +
  "| total tokens | \(total_tokens) |\n" +
  "| input | \(.tokens.input // 0) |\n" +
  "| output | \(.tokens.output // 0) |\n" +
  "| reasoning | \(.tokens.reasoning // 0) |\n" +
  "| cache read/write | \(.tokens.cache.read // 0) / \(.tokens.cache.write // 0) |\n" +
  "| compactions | \(.compactions // 0) |\n" +
  "| sessions | \((.sessionIDs // []) | length) |\n\n" +
  "**Tool calls**\n" + top(.toolCalls) + "\n\n" +
  "**Skill usage**\n" + top(.skills) + "\n\n" +
  "_Captured from opencode event hooks. Context-window fullness is not exposed directly; token totals are nearest proxy._"
' "$METRICS_FILE")"

gh pr comment "$PR_NUMBER" --body "$BODY" >/dev/null
printf 'Posted opencode metrics comment for PR #%s.\n' "$PR_NUMBER"
