# Coding agent with manual credential brokering

A coding agent example to work on the public [`vercel/ms`](https://github.com/vercel/ms) repository using manual credential brokering.

- Clones `ms` into a Vercel Sandbox and installs its dependencies.
- Uses `harness-agent-eve-extension` to provide fixed `explain_code`, `write_code`, `review_code`, and `security_audit` tools, each pinned to the `ms` working directory.
- Disables the dynamic `harness_agent` tool.
- Configures manual brokering for `AI_GATEWAY_API_KEY` and `VERCEL_OIDC_TOKEN` using sandbox placeholders and a Vercel Sandbox network policy.

## Usage

Run locally via:
```sh
cd examples/coding-agent-credential-brokering-manual
pnpm exec eve link
pnpm dev
```

Ask something like:

> Use the explain_code tool to explain what the `ms` project does.

Or:

> Use the write_code tool to add different locale support to ms, e.g. so that strings like "2 Tage" work just as well as "2 days".
