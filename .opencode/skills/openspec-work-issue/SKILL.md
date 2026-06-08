---
name: openspec-work-issue
description: Use when working GitHub Issues generated from an OpenSpec change, especially phrases like "work issue #N", "openspec issue #N", "dispatch next OpenSpec issue", or "work the OpenSpec queue".
---

# OpenSpec Work Issue

Work exactly one GitHub issue from an approved OpenSpec change. GitHub Issues are execution trackers; OpenSpec artifacts remain the source of truth.

## When To Use

Use this skill when the user asks to:

- Work a specific GitHub issue linked to OpenSpec
- Work the next issue in an OpenSpec milestone
- Continue an OpenSpec implementation queue
- Use a worktree for issue-specific implementation

Do not use this skill for creating proposals, designs, specs, or tasks. Use the normal OpenSpec artifact skills for that.

## Required Input

Prefer a GitHub issue number only:

```bash
.opencode/scripts/openspec-dispatch-issue.sh 3
```

or:

```bash
.opencode/scripts/openspec-dispatch-issue.sh '#3'
```

The script infers the OpenSpec change from the issue body marker:

```text
OpenSpec change: `<change-name>`
```

If that marker is missing, it falls back to the issue milestone title.

To select the next issue automatically, pass a change name with `--next`:

```bash
.opencode/scripts/openspec-dispatch-issue.sh --next create-finance-import-mvp
```

To let the local machine pick up ready issues automatically, apply the
`agent-ready` label to an open issue assigned to the current GitHub user, then
run the watcher from the primary checkout:

```bash
.opencode/scripts/openspec-watch-agent-ready.sh
```

For cron/launchd-style polling, run one tick:

```bash
.opencode/scripts/openspec-watch-agent-ready.sh --once
```

The watcher spawns `.opencode/scripts/openspec-agent-ready-worker.sh <issue>`,
which dispatches the issue, creates or reuses the worktree, removes
`agent-ready`, adds `openspec-in-progress`, and runs `opencode run` in that
worktree with this skill's workflow prompt.

## Worktree Rule

Implementation MUST happen in the issue worktree created by the dispatcher, not in the primary checkout.

Expected layout:

```text
personal-finance/
personal-finance-worktrees/
  issue-1-project-foundation/
  issue-2-database-schema/
```

## Implementation Rules

Before editing application code:

1. Verify the issue body or milestone identifies the OpenSpec change.
2. Read these files from the worktree:
   - `openspec/changes/<change-name>/proposal.md`
   - `openspec/changes/<change-name>/design.md`
   - `openspec/changes/<change-name>/tasks.md`
   - relevant `openspec/changes/<change-name>/specs/**/*.md`
3. Confirm the proposal is approved.
4. Identify only the `tasks.md` rows that reference the issue number.

Scope rules:

- Implement only the task rows linked to the current issue number.
- Do not silently expand scope.
- If the issue requires changing accepted scope, stop and update OpenSpec artifacts first.
- Do not archive the OpenSpec change while working implementation issues.
- Preserve unrelated user changes.

Task update rules:

- Mark only matching task rows complete.
- Preserve the issue reference, for example `(#3)`.
- Do not check off unrelated tasks.

Example:

```md
- [x] 3.1 Implement backend CSV parsing with Polars for uploaded files (#3)
- [x] 3.2 Implement backend preview response with detected headers and up to 5 parsed data rows (#3)
```

## Verification

Run verification appropriate to the issue. At minimum:

- Run relevant backend tests for backend work.
- Run relevant frontend tests or build checks for frontend work.
- Run `openspec status --change "<change-name>"` after updating task checkboxes.

If no test harness exists yet, document that clearly in the PR and use the best available manual verification.

## Shipping

After implementation and verification, use the `ship` skill to commit, push, and open the PR.

The PR MUST:

- Reference the OpenSpec change.
- Include `Closes #<issue-number>` in the body.
- Mention the exact `tasks.md` rows completed.
- Stay scoped to one issue.

After the PR is opened, run the `caveman-review` skill against the PR before asking the user to review. If `caveman-review` is not available in the current session, explicitly tell the user that the review skill was unavailable and ask whether to run the available review process instead.

## Issue State

The dispatcher uses these labels:

- `agent-ready`
- `openspec-in-progress`
- `openspec-done`

Only one issue in a milestone should have `openspec-in-progress` at a time. If another issue is in progress, stop and ask the user whether to continue that issue or clear the label.
