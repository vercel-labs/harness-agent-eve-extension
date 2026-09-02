# `HarnessAgent` eve extension

Exposes [AI SDK `HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) as a tool for your [eve](https://eve.dev/) agents.

_Very early and experimental. **Use with caution.**_

## Installation

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm install harness-agent-eve-extension` | `pnpm add harness-agent-eve-extension` | `bun add harness-agent-eve-extension` |

## Prerequisites

Using `HarnessAgent` in eve requires a network sandbox which exposes at least one port, as required by harness adapters whose underlying SDK has to run inside the sandbox.

Currently, since eve extensions and tools do not have sufficient access to the eve agent's sandbox backend, this extension requires using Vercel Sandbox.

Here's the minimum configuration needed in your `agent/sandbox.ts` file:

```ts
import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

export default defineSandbox({
  backend: vercel({ ports: [4319] }), // At least one free port.
});
```

## Usage

Add `agent/extensions/harness-agent.ts` to your eve agent:

```ts
import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: true,
});
```

With this configuration, your agent will expose a flexible `harness_agent` tool that your eve agent can delegate tasks to. You will be asked to approve the `harness_agent` tool every time the eve agent wants to use it.

> [!WARNING]
> The dynamic `harness_agent` tool is complex to use for agents because it is so flexible.
>
> It is therefore recommended to not enable that tool and instead define purpose-specific tools using `HarnessAgent` (see below).

### Preconfigured purpose-specific tools (recommended)

Use `fixedHarnessAgentTools` to expose additional HarnessAgent tools with fixed settings for specific purposes, such as reviewing code or running a security audit:

```ts
import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: false,
  fixedHarnessAgentTools: [
    {
      name: "code_review_harness_agent",
      description: "Review code changes in the repository and report findings.",
      harnesses: ["claude-code", "codex"],
      instructions: "You are a meticulous code reviewer...",
      workingDirectory: "ms",
    },
    {
      name: "security_audit_harness_agent",
      description: "Audit the repository for security vulnerabilities.",
      harnesses: "all",
      instructions: "You are a security auditor...",
      workingDirectory: "ms",
    },
  ],
});
```

Each entry exposes one tool, named by its `name` (lowercase letters, digits, and underscores). The calling model only chooses the `task` and, among the enabled `harnesses`, the `harness` to run; everything else is fixed from the config:

- `description` (required): model-facing tool description.
- `harnesses`: `"all"` (the default) or a non-empty allowlist of supported harnesses.
- `models`: optional model override per harness; omitted harnesses use their native default model.
- `instructions`, `skills`, `workingDirectory`, `id`: the HarnessAgent settings, with the same shapes as the `harness_agent` tool input.

All values must be JSON-serializable. When `fixedHarnessAgentTools` is omitted or empty, no additional tools are exposed. Fixed tools always return the harness's text output as a string; configuring an output schema is not supported.

## Credential brokering

Harness adapters discover credentials in the eve agent's host process and may
forward them into their sandbox processes. Configure `credentialBrokering` to
choose who replaces those credentials at the sandbox boundary:

- `{ mode: "auto" }` lets the extension manage brokering. AI SDK generates
  per-run placeholder credentials for the sandbox, and the extension installs
  host-side Vercel Sandbox request transformations that replace a matching
  placeholder only after the request leaves the sandbox. This is the
  recommended mode when the extension should own brokering.
- `{ mode: "manual", sandboxCredentialOverrides: { ... } }` changes only the
  values forwarded into sandbox processes. The root eve agent remains
  responsible for matching those values and injecting the real credentials in
  its Vercel Sandbox network policy.
- `{ mode: "none" }` preserves the previous behavior: the harness adapter
  forwards real credentials into the sandbox. This is the default for
  backward compatibility.

Credential brokering applies to the sandbox-backed Claude Code, Codex, Cursor,
DeepAgents, fx, Grok Build, and OpenCode harnesses. Cline and Pi perform model
access in the host process and do not receive sandbox credential handling.

### Automatic brokering

```ts
import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  credentialBrokering: { mode: "auto" },
  exposeDynamicHarnessAgentTool: true,
});
```

Automatic mode requires Vercel Sandbox and takes exclusive ownership of
request transformations while HarnessAgent runs are active. Existing
transformed-header rules are rejected because Vercel redacts their credential
values when policies are read back, so the extension cannot preserve them
safely. Do not mutate the sandbox network policy from the root agent while
automatic HarnessAgent runs are active. The extension preserves the initial
host allowlist, subnet rules, and forwarding rules, merges transformations
from concurrent HarnessAgent runs, and restores an empty transformation set
after the final run.

### Manual brokering

Manual mode is useful when the root eve agent must retain control over its
firewall policy. Use non-secret, unguessable sandbox credentials and configure
the same values on both sides:

```ts
// agent/credential-placeholders.ts
export const sandboxCredentials = {
  AI_GATEWAY_API_KEY: requireEnvironmentVariable(
    "HARNESS_SANDBOX_AI_GATEWAY_PLACEHOLDER",
  ),
  VERCEL_OIDC_TOKEN: requireEnvironmentVariable(
    "HARNESS_SANDBOX_OIDC_PLACEHOLDER",
  ),
};

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}
```

```ts
// agent/extensions/harness-agent.ts
import harnessAgent from "harness-agent-eve-extension";

import { sandboxCredentials } from "../credential-placeholders";

export default harnessAgent({
  credentialBrokering: {
    mode: "manual",
    sandboxCredentialOverrides: sandboxCredentials,
  },
  exposeDynamicHarnessAgentTool: true,
});
```

```ts
// agent/sandbox.ts
import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";

import { sandboxCredentials } from "./credential-placeholders";

const gatewayCredential =
  process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
if (!gatewayCredential) {
  throw new Error("Missing AI Gateway credentials.");
}

export default defineSandbox({
  backend: vercel({
    ports: [4319],
    networkPolicy: {
      allow: {
        "ai-gateway.vercel.sh": [
          {
            match: {
              headers: [
                {
                  key: { exact: "authorization" },
                  value: {
                    exact: `Bearer ${sandboxCredentials.AI_GATEWAY_API_KEY}`,
                  },
                },
              ],
            },
            transform: [
              {
                headers: {
                  authorization: `Bearer ${gatewayCredential}`,
                },
              },
            ],
          },
          {
            match: {
              headers: [
                {
                  key: { exact: "authorization" },
                  value: {
                    exact: `Bearer ${sandboxCredentials.VERCEL_OIDC_TOKEN}`,
                  },
                },
              ],
            },
            transform: [
              {
                headers: {
                  authorization: `Bearer ${gatewayCredential}`,
                },
              },
            ],
          },
        ],
        "*": [],
      },
    },
  }),
});
```

The extension first matches the environment-variable name. It also replaces a
forwarded value when it equals the current host value of a configured source
variable. This covers adapters that rename credentials—for example, Codex may
forward the value from `AI_GATEWAY_API_KEY` as `CODEX_API_KEY`. Value matching
is a pragmatic fallback: if several configured source variables contain the
same real value, they must use the same sandbox override or forwarding fails
as ambiguous. Manual mode does not validate or install the root agent's
firewall transformation; an incomplete or mismatched policy leaves the
sandbox unable to authenticate.

### Example

This repo includes a basic coding agent example in `examples/coding-agent`. You can use it for testing the extension end-to-end.

Before the first time using it, link it to a Vercel project for credentials:
```sh
cd examples/coding-agent
vc link
```

You can then run it from the repo root:
```sh
pnpm --filter coding-agent dev
```

For more information on the example, see [its readme](./examples/coding-agent/README.md).

## Known caveat

eve does not currently support non-eve subagents, therefore extension provides `HarnessAgent` access via tools. This means there is no native observability for the underlying `HarnessAgent` and no preliminary thought or tool call streaming feedback.

If you give a complex task to the `harness_agent` tool, the tool may therefore run for several minutes without feedback. This does not mean that it's hanging. It should eventually complete its work, unblocking the primary eve agent.

## Contributing

All PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by CI). PRs are squash-merged, so the title becomes the commit message.

Commit types and their effect on versioning:
- `fix:` → patch release
- `feat:` → minor release
- `feat!:` or `BREAKING CHANGE:` footer → major release
- `chore:`, `docs:`, `ci:`, `refactor:`, `test:`, etc. → no release (not included in changelog)
