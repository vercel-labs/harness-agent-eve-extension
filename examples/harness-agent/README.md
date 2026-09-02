# Harness agent

A coding agent example using the dynamic `harness_agent` tool with the public [`vercel/ms`](https://github.com/vercel/ms) repository.

- Clones `ms` into a Vercel Sandbox and installs its dependencies.
- Uses `harness-agent-eve-extension` to provide only the dynamic `harness_agent` tool.
- Allows the model to choose the HarnessAgent harness and settings for each task.

## Usage

Run locally via:
```sh
cd examples/harness-agent
pnpm exec eve link
pnpm dev
```

Ask something like:

> Use the fx harness to explain what the `ms` project does.

Or:

> Use the Codex harness to add different locale support to ms, e.g. so that strings like "2 Tage" work just as well as "2 days".
