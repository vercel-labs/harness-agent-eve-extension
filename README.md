# `HarnessAgent` eve extension

Exposes [AI SDK `HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) as a tool for your [eve](https://eve.dev/) agents.

_Very early and experimental. **Use with caution.**_

## Installation

| NPM | PNPM | Bun |
| --- | --- | --- |
| `npm install harness-agent-eve-extension` | `pnpm add harness-agent-eve-extension` | `bun add harness-agent-eve-extension` |

## Documentation

- [Getting started](./docs/01-getting-started.md)
- [Credential brokering](./docs/02-credential-brokering.md)

## Examples

This repo includes the following examples for testing the extension end-to-end.

With only fixed `HarnessAgent` tools that have concrete purposes and therefore are straightforward to use:

- [Coding agent (without credential brokering)](./examples/coding-agent/README.md)
- [Coding agent with automatic credential brokering](./examples/coding-agent-credential-brokering-auto/README.md)
- [Coding agent with manual credential brokering](./examples/coding-agent-credential-brokering-manual/README.md)

With only the generic `HarnessAgent` tool that can be used for anything but is more complex to use:

- [Harness agent](./examples/harness-agent/README.md)

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
