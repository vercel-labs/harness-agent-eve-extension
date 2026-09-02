# Coding agent with automatic credential brokering

This example delegates coding tasks to the flexible `harness_agent` tool, provided by the `harness-agent-eve-extension` package.

The extension is configured with `credentialBrokering: { mode: "auto" }`.
AI SDK generates credentials that are safe to expose inside the sandbox, and
the extension installs host-side Vercel Sandbox request transformations that
replace them with the real credentials only after matching requests leave the
sandbox.

Its Vercel Sandbox contains the public [`vercel/ms`](https://github.com/vercel/ms) TypeScript repository at `/workspace/ms`.

The sandbox template clones the current `main` branch and installs its dependencies. When a new eve session first uses the sandbox, the example pulls the latest code and installs dependencies.

## Usage

Run locally via:
```sh
cd examples/coding-agent-credential-brokering-auto
pnpm exec eve link
pnpm dev
```

Ask something like:

> Use the fx harness to explain what the `ms` project does.

Or:

> Use the Codex harness to add different locale support to ms, e.g. so that strings like "2 Tage" work just as well as "2 days".

## Fixed harness agent tools

The example also preconfigures four purpose-specific tools via `fixedHarnessAgentTools` in `agent/extensions/harness-agent.ts`, each pinned to the `ms` working directory:

- `explain_code` — explains code read-only, concisely.
- `write_code` — implements requested code changes and validates them.
- `review_code` — reviews code read-only and starts its reply with APPROVED, NEUTRAL, or CHANGES-REQUESTED.
- `security_audit` — audits the repository for security flaws and starts its reply with PASS, NEUTRAL, or FAIL.

Ask something like:

> Use the explain_code tool to walk me through the parser in ms.
