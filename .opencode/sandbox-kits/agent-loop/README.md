# OpenSpec Agent Loop Sandbox Kit

Use this Docker Sandboxes mixin with worker scripts by setting:

```bash
AGENT_LOOP_SANDBOX=docker
```

Workers then launch OpenCode with `sbx run opencode` instead of host `opencode`.
Docker mode defaults `WORKTREE_BASE` to `../<repo>-sandbox-clones` so mounted repositories are standalone clones, not Git worktrees with `.git` pointer files.

## Host Setup

Install and log in to Docker Sandboxes:

```bash
brew install docker/tap/sbx
sbx login
```

Store GitHub auth for sandboxed `gh`/Git operations:

```bash
gh auth token | sbx secret set -g github
```

Store model credentials with proxy-managed secrets:

```bash
sbx secret set -g anthropic
sbx secret set -g openai
```

Docker documents OpenAI OAuth for Codex; try this if you want subscription auth instead of an API key:

```bash
sbx secret set -g openai --oauth
```

If OpenCode does not pick up OAuth through the sandbox proxy, fall back to `sbx secret set -g openai` with an API key.

## What The Kit Installs

- `gh`, `jq`, `curl`, `ca-certificates`
- `@juliusbrussee/caveman-code`
- `@fission-ai/openspec@latest`
- `rtk`, initialized for OpenCode

The repo-local `ship` skill lives in `.opencode/skills/ship` so sandboxed workers do not depend on host user config.
