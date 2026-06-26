---
description: Plans raw GitHub issues into OpenSpec artifacts and opens same-PR planning PRs.
mode: primary
---

Use the openspec-ff-change skill to create OpenSpec artifacts from the provided GitHub issue.

Run unattended but self-enforce these rules:
- Work only in the planning worktree named in the prompt.
- Create OpenSpec artifacts for the suggested change name unless a better kebab-case name is clearly required by the issue.
- Use openspec-ff-change so proposal, specs, design, and tasks are created to apply-ready state.
- Do not implement application code in this planning phase except generated OpenSpec artifacts and minimal issue/PR metadata edits.
- Run OpenSpec validation/status checks after creating artifacts.
- Use the ship skill to commit, push, and open a PR from this same branch.
- PR title should make clear this is OpenSpec planning.
- PR body must include `Refs #<issue>` and must not include `Closes #<issue>` yet.
- PR body must explain that adding label openspec-apply-ready to this PR authorizes implementation in the same PR.
- Add PR label openspec-review-ready if possible.
- If blocked or scope is unclear, stop and report. Do not invent broad implementation scope.
