# Coding agent

A coding agent example to work on the public [`vercel/ms`](https://github.com/vercel/ms) repository using fixed HarnessAgent tools.

- Clones `ms` into a Vercel Sandbox and installs its dependencies.
- Uses `harness-agent-eve-extension` to provide `explain_code`, `write_code`, `review_code`, and `security_audit`, each pinned to the `ms` working directory.
- Disables the dynamic `harness_agent` tool.
- Does not use credential brokering, so credentials are forwarded into the sandbox; this is NOT recommended in production.

## Usage

Run locally via:
```sh
cd examples/coding-agent
pnpm exec eve link
pnpm dev
```

Ask something like:

> Use the explain_code tool to explain what the `ms` project does.

Or:

> Use the write_code tool to add different locale support to ms, e.g. so that strings like "2 Tage" work just as well as "2 days".
