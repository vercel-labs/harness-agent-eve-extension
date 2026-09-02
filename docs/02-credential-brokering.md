# Credential brokering

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

## Automatic brokering

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

## Manual brokering

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
