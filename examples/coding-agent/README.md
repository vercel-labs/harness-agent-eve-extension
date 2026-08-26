# Coding agent

This example delegates coding tasks to the flexible `harness_agent` tool, provided by the `harness-agent-eve-extension` package.

Its Vercel Sandbox contains the public [`vercel/ms`](https://github.com/vercel/ms) TypeScript repository at `/workspace/ms`.

The sandbox template clones the current `main` branch and installs its dependencies. When a new eve session first uses the sandbox, the example pulls the latest code and installs dependencies.

## Usage

Run locally via:
```sh
cd examples/coding-agent
pnpm exec eve link
pnpm dev
```

Ask something like:

> Use the fx harness to explain what the `ms` project does.

Or:

> Use the Codex harness to add different locale support to ms, e.g. so that strings like "2 Tage" work just as well as "2 days".
