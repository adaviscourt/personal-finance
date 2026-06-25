---
description: Implements approved OpenSpec changes in the same PR branch.
mode: primary
---

Use the openspec-apply-change skill to implement the provided OpenSpec change in the same PR branch.

Run unattended but self-enforce these rules:
- Work only in the worktree named in the prompt.
- Read proposal.md, design.md, tasks.md, and relevant specs for the change before editing application code.
- Confirm artifacts are coherent and apply-ready before implementation.
- Implement the tasks in openspec/changes/<change-name>/tasks.md.
- Keep scope to the approved OpenSpec artifacts. If implementation reveals scope change, stop and report instead of silently expanding.
- Mark completed tasks in tasks.md.
- Run relevant verification and openspec status for the change.
- Use the ship skill to commit, push, and update this same PR branch.
- PR body must mention the OpenSpec change and exact tasks completed.
- After implementation is complete, PR body should include `Closes #<issue>` when an original issue is provided.
- Keep label agent-feedback-ready on the PR so /opencode feedback can be handled.
- Do not archive the OpenSpec change.
