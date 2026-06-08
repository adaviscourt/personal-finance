---
name: openspec-github-issues
description: Generate GitHub milestones and issues from an approved OpenSpec tasks.md. Use when the user says openspec-issues, create issues from OpenSpec tasks, or sync OpenSpec tasks to GitHub Issues.
license: MIT
compatibility: Requires openspec CLI, GitHub CLI (`gh`), and an authenticated GitHub repository.
metadata:
  author: openspec
  version: "1.0"
---

# OpenSpec GitHub Issues

Generate GitHub milestones and issues from an approved OpenSpec change.

OpenSpec remains the canonical source of scope and requirements. GitHub Issues are downstream execution trackers for approved tasks.

**Input**: Optionally specify a change name. If omitted, infer from conversation only when unambiguous; otherwise ask the user to select from active OpenSpec changes.

## Workflow

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Run `openspec list --json` to get active changes.
   - Auto-select only if there is exactly one active change.
   - If ambiguous, ask the user which change to use.

   Announce: `Using change: <name>`.

2. **Verify the repository and GitHub CLI**

   Run:
   ```bash
   gh repo view --json nameWithOwner,url
   ```

   If this fails, stop and explain that GitHub issue generation requires an authenticated `gh` session in a GitHub-backed repo.

3. **Read OpenSpec context**

   Read these files when present:
   - `openspec/changes/<name>/proposal.md`
   - `openspec/changes/<name>/design.md`
   - `openspec/changes/<name>/tasks.md`
   - `openspec/changes/<name>/specs/**/*.md`

   If `tasks.md` is missing, stop and suggest finishing the OpenSpec proposal flow first.

4. **Require proposal approval**

   Do not create issues unless the proposal is approved.

   Treat the proposal as approved if one of these appears in `proposal.md`:
   - `Status: approved`
   - `Status: Approved`
   - A section titled `## Approval` with non-empty approval details
   - An approval line such as `Approved:` or `Approver:`

   If approval is missing:
   - Show the missing gate clearly.
   - Offer to add an approval marker if the user explicitly confirms approval.
   - Do not create a milestone or issues without confirmation.

5. **Create or reuse the milestone**

   Use the OpenSpec change ID as the GitHub milestone title exactly:
   ```text
   <change-name>
   ```

   Check for an existing milestone:
   ```bash
   gh api repos/:owner/:repo/milestones --paginate
   ```

   If no open milestone has the same title, create one:
   ```bash
   gh api repos/:owner/:repo/milestones \
     --method POST \
     -f title="<change-name>" \
     -f description="OpenSpec change: openspec/changes/<change-name>/\n\nProposal: openspec/changes/<change-name>/proposal.md\nTasks: openspec/changes/<change-name>/tasks.md"
   ```

6. **Parse issue-worthy tasks**

   Convert top-level incomplete tasks in `tasks.md` into issues.

   Prefer issue-worthy tasks:
   - Top-level checklist items like `- [ ] 1. Add import parser`
   - Top-level checklist items like `- [ ] Add import parser`
   - Parent tasks with meaningful implementation scope

   Avoid creating issues for:
   - Completed tasks (`- [x]`)
   - Mechanical subtasks under a parent item
   - Tiny cleanup items that are better kept only in `tasks.md`
   - Tasks that already include an issue reference like `#42`

   If the task list is too granular, group related items and explain the grouping before creating issues.

7. **Prevent duplicates**

   Before creating an issue for a task, search open and closed issues for the OpenSpec source marker:
   ```text
   OpenSpec task source: openspec/changes/<change-name>/tasks.md
   OpenSpec task: <task text>
   ```

   Use `gh issue list --state all --search` or `gh search issues` when available. If a matching issue exists, reuse it and update `tasks.md` with its issue number instead of creating a duplicate.

8. **Create issues**

   Create each issue with:
   - Title based on the task text
   - Milestone `<change-name>`
   - Labels only if the repo already uses suitable labels; do not invent many labels
   - Body linking back to OpenSpec artifacts

   Body template:

   ```markdown
   OpenSpec change: `<change-name>`
   OpenSpec task source: `openspec/changes/<change-name>/tasks.md`
   OpenSpec task: <task text>

   ## Task

   <task text>

   ## Acceptance

   - Matches the approved OpenSpec proposal and specs
   - Updates relevant tests or verification steps
   - Marks the corresponding task complete in `tasks.md`

   ## OpenSpec Context

   - Proposal: `openspec/changes/<change-name>/proposal.md`
   - Design: `openspec/changes/<change-name>/design.md`
   - Tasks: `openspec/changes/<change-name>/tasks.md`

   ## Scope Rule

   Do not change accepted scope in this issue without updating the OpenSpec artifacts first.
   ```

   Use `gh issue create` for issue creation. Capture the created issue URL or number.

9. **Update tasks.md with issue links**

   After issue creation or reuse, update the corresponding task line to include the issue reference:

   ```markdown
   - [ ] 1. Add import parser (#42)
   ```

   Preserve the existing task wording and checkbox status. Only append the issue reference when missing.

10. **Show summary**

   Summarize:
   - Change name
   - Milestone title and URL if available
   - Issues created
   - Existing issues reused
   - Tasks skipped and why
   - Any manual follow-up needed

## Guardrails

- Never create GitHub issues before proposal approval.
- OpenSpec remains canonical; GitHub Issues track execution.
- Do not silently change scope while generating issues.
- Do not create issues for completed tasks.
- Do not duplicate issues for tasks that already reference an issue number.
- Prefer fewer, meaningful issues over one issue per tiny subtask.
- If grouping tasks, explain the grouping and ask before proceeding if the grouping is not obvious.
- If `gh` commands fail, stop and report the exact command and failure.
- If editing OpenSpec config, agent files, skills, commands, or plugins, remind the user to restart opencode.

## Output On Success

```markdown
## GitHub Issues Generated

Change: `<change-name>`
Milestone: `<change-name>`

Created:
- #42 Add import parser
- #43 Add transaction normalization

Reused:
- #40 Add tests

Updated:
- `openspec/changes/<change-name>/tasks.md` with issue references
```

## Output When Approval Is Missing

```markdown
## Approval Required

Change: `<change-name>`

No proposal approval marker was found in `openspec/changes/<change-name>/proposal.md`.

Add one of:
- `Status: approved`
- `## Approval` with approver/date details
- `Approved: <date>`

No GitHub milestone or issues were created.
```
