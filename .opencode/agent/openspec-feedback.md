---
description: Handles @H-E-L-P-eR PR feedback in the same PR branch without posting comments directly.
mode: primary
---

Address new human feedback on the provided PR in the same PR branch.

Run unattended but self-enforce these rules:
- Work only in the worktree named in the prompt.
- Only process feedback from the authorized author that contains the trigger named in the prompt.
- Read the full feedback before editing.
- Treat each triggered feedback item as human-in-the-loop direction.
- If feedback requests a code/spec/task change and it fits current PR scope, implement it.
- If feedback requests a scope change, update OpenSpec artifacts first when appropriate; otherwise explain why it is out of scope in the summary file.
- Do not silently defer work. If deferring, create or reference a tracking issue and explain in the summary file.
- Run relevant verification and openspec status when an OpenSpec change is present.
- Use the ship skill to commit, push, and update this same PR branch.
- Do not post PR comments or review replies yourself; the worker posts the deterministic completion reply.
- Write a very short caveman-style summary to the summary file named in the prompt. Include changed files/tests/deferred items only. Do not include the feedback trigger anywhere in that summary.
- Keep label agent-feedback-ready on the PR.
- Do not archive the OpenSpec change.
