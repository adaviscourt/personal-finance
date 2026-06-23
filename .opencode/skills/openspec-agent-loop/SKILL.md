---
name: openspec-agent-loop
description: Use when running or explaining the local GitHub issue-to-OpenSpec-to-PR agent loop, including agent-ready, openspec-apply-ready, and @opencode PR feedback automation.
compatibility: Requires opencode CLI, OpenSpec CLI, GitHub CLI, jq, git, and iTerm2 for tab spawning.
---

# OpenSpec Agent Loop

Local GitHub-native automation for turning human-authored issues into same-PR OpenSpec planning, implementation, and feedback loops.

## Phases

```text
GitHub issue + agent-ready
  -> OpenSpec planning worker
  -> PR with OpenSpec artifacts
  -> human labels PR openspec-apply-ready
  -> implementation worker updates same PR
  -> human comments @opencode on PR
  -> feedback worker updates same PR
  -> human merges
  -> archive workflow runs on main
```

## Labels

- `agent-ready`: raw issue is ready for local planning pickup.
- `openspec-planning`: planning worker is running.
- `openspec-review-ready`: OpenSpec artifact PR is ready for human review.
- `openspec-apply-ready`: human approved artifact PR for implementation in same PR.
- `openspec-implementing`: implementation or feedback worker is running.
- `agent-feedback-ready`: PR accepts `@opencode` feedback pickup.
- `agent-done`: agent believes PR is ready for human review.
- `agent-blocked`: agent stopped and needs human help.

## Commands

Run all watchers in one foreground process:

```bash
.opencode/scripts/openspec-agent-loop-watch.sh
```

Run one full local tick:

```bash
.opencode/scripts/openspec-agent-loop-tick.sh
```

Run continuous planning watcher:

```bash
.opencode/scripts/openspec-watch-agent-ready-planning.sh
```

Run continuous apply watcher:

```bash
.opencode/scripts/openspec-watch-apply-ready.sh
```

Run continuous feedback watcher:

```bash
.opencode/scripts/openspec-watch-pr-feedback.sh
```

Run specific workers manually:

```bash
.opencode/scripts/openspec-plan-issue-worker.sh 123
.opencode/scripts/openspec-apply-pr-worker.sh 45
.opencode/scripts/openspec-pr-feedback-worker.sh 45
```

## Human Workflow

1. Create GitHub issue assigned to yourself, authored by yourself, label `agent-ready`.
2. Planning worker creates OpenSpec artifacts and opens a PR with `Refs #<issue>`.
3. Review artifacts in PR.
4. Add `openspec-apply-ready` to same PR when approved.
5. Implementation worker updates same PR and changes linkage to `Closes #<issue>`.
6. Add PR comments or review comments beginning with `@opencode` for follow-up changes.
7. Feedback worker reacts with eyes, updates the same branch, then marks processed feedback in local state and reacts with `hooray` where GitHub supports reactions.

## State

State lives under:

```text
~/.opencode/state/<repo-name>/
```

Important files:

- `openspec-agent-loop.heartbeat`: last tick timestamp.
- `openspec-agent-loop-watch.heartbeat`: all-watchers supervisor heartbeat.
- `pr-<number>-opencode-feedback-processed.txt`: processed PR feedback IDs.
- `*.lock.d`: lock dirs preventing duplicate workers.
- `*.log`: watcher/worker logs.

## Packaging Options

- Foreground local dev: run `.opencode/scripts/openspec-agent-loop-watch.sh` in one iTerm tab.
- Cron/launchd style: run `.opencode/scripts/openspec-agent-loop-tick.sh` every minute.
- Manual debugging: run a specific watcher or worker directly.

Prefer the foreground supervisor while iterating because logs are centralized and Ctrl-C stops all child watchers cleanly. Prefer launchd once the loop is stable and should survive terminal restarts.

## Guardrails

- Planning phase uses `openspec-ff-change`; it must not implement application code.
- Implementation phase uses `openspec-apply-change`; it must keep scope to approved artifacts.
- Same PR is used for planning and implementation.
- Raw issue is not closed until implementation is complete.
- Feedback pickup requires explicit `@opencode` mention.
- Feedback de-dupe is based on processed GitHub comment/review IDs, not emoji state.
- No automatic merge.
- Do not archive from local workers; existing GitHub archive workflow handles merge-to-main completion.

## iTerm Behavior

Watchers spawn a new iTerm2 tab in the current window when iTerm2 is available. If iTerm spawning fails, workers run in the background and log to the state dir.
