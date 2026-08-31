# `HarnessAgent` eve extension

Exposes [AI SDK `HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) as a tool for your [eve](https://eve.dev/) agents.

## Installation

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm install harness-agent-eve-extension` | `pnpm add harness-agent-eve-extension` | `bun add harness-agent-eve-extension` |

## Usage

Add `agent/extensions/harness-agent.ts` to your eve agent:

```ts
import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: true,
});
```

With this configuration, your agent will expose a flexible `harness_agent` tool that your eve agent can delegate tasks to. You will be asked to approve the `harness_agent` tool every time the eve agent wants to use it.

> [!CAUTION]
> The dynamic `harness_agent` tool is complex to use for agents because it is so flexible.
>
> It is therefore recommended to not enable that tool and instead define purpose-specific tools using `HarnessAgent` (see below).

### Preconfigured purpose-specific tools (recommended)

Use `fixedHarnessAgentTools` to expose additional HarnessAgent tools with fixed settings for specific purposes, such as reviewing code or running a security audit:

```ts
import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: true,
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
