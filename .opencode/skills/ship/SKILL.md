---
name: ship
description: Ship current changes — commit, push, and open/update a PR. Use after completing code changes.
disable-model-invocation: false
---

Ship the current changes: commit, push, and open/update a PR.

## Instructions

1. Run `git status` and `git diff` to understand all changes (staged + unstaged).
2. If there are no changes, say so and stop.
3. Stage all relevant files (avoid secrets, .env, large binaries, devenv, out/).
4. Determine the current branch situation and associated PR state:

- Run `scripts/pr-status` from this skill directory before deciding whether to update or create a PR.
- Treat its output as the source of truth for the current branch's associated PR.
- If the output is `PR_STATUS open ...`, update that PR when shipping from the feature branch.
- If the output is `PR_STATUS merged ...` or `PR_STATUS closed ...`, do not offer to update that PR and do not push more work to that already-shipped branch. Create a new branch from the latest base branch instead, then commit, push, and open a new PR.
- If the output is `PR_STATUS none ...`, there is no associated PR for the current branch.
- If the output is `PR_STATUS gh-missing ...`, say GitHub CLI is unavailable and ask before making PR assumptions.
- Keep PR-state reporting compact in user-facing messages, e.g. `PR #11 is merged; I created a new branch from master for follow-up work.`

### If on a feature branch with an open PR:
- Commit with a message based on the diff (not the conversation).
- Push to the existing branch.
- Update the PR title/body with the REST API, not `gh pr edit` (see PR update commands below).
- Return the PR URL.

### If on a feature branch with no PR:
- Commit with a message based on the diff.
- Push the branch.
- Open a new PR (see PR format below).
- Return the PR URL.

### If on a feature branch with a merged or closed PR:
- Fetch the latest base branch.
- Create a new descriptive branch from the latest base branch.
- Commit with a message based on the diff.
- Push the new branch with `-u`.
- Open a new PR (see PR format below).
- Return the new PR URL.

### If on master:
- Create a new branch with a descriptive kebab-case name based on the changes.
- Commit with a message based on the diff.
- Push the branch with `-u`.
- Open a new PR (see PR format below).
- Return the PR URL.

## PR Title Format

- Use the format of "<type>([optional scope]): <description>", where:
  - "type" is one of:
    - build - Changes that affect the build system or external dependencies (dependencies update)
    - ci - Changes CI configuration files and scripts (ex. .github/workflows)
    - docs - Docs only changes
    - feat - A new feature
    - fix - A bug fix
    - chore - Changes which does not touch the code (ex. manual update of release notes)
    - refactor - A code change that contains refactor
    - style - Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
    - test - Adding missing tests or correcting existing tests and also changes for our test app
    - perf - A code change that improves performance
  - "optional scope" is a specific submodule / service, if applicable
  - "description" is terse, imperative, lowercase

## PR Description Format

Base the description **entirely on the git diff against master**, not on conversation context or commit messages.

- The sections should be **What**, **Why**, **Notes**, **Tests**, and **Verification Process**, all header1 (single #)
- Only omit above sections if they are irrelevant for the task.

## PR Update Commands

Avoid `gh pr edit` when updating title, body, or base. It can hit GitHub's Projects classic GraphQL deprecation even when no project data is being changed.

For an existing PR, use REST instead:

```bash
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh api -X PATCH "/repos/$repo/pulls/<pr-number>" \
  -f title='<pr-title>' \
  -f body="$(cat <<'EOF'
<pr-body>
EOF
)"
```

To update only the base branch, use:

```bash
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh api -X PATCH "/repos/$repo/pulls/<pr-number>" -f base='<base-branch>'
```

Use `gh pr create` for new PRs; this deprecation issue is specific to `gh pr edit`.

## Rules

- Commit message: use /caveman-review
- Only stage files directly related to the task. Never commit untracked/modified files that are unrelated to the current changes (e.g., local config, build artifacts, editor state).
- Always end commit messages with: `Co-Authored-By: <model_name> <noreply@opencode.ai>` using the actual model name from the current session
