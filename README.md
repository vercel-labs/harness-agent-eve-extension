# `HarnessAgent` eve extension

Exposes [AI SDK `HarnessAgent`](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent) as a tool for your [eve](https://eve.dev/) agents.

## Usage

Add `agent/extensions/harness-agent.ts` to your eve agent:

```ts
import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: true,
});
```

With this configuration, your agent will expose a flexible `harness_agent` tool that your eve agent can delegate tasks to. You will be asked to approve the `harness_agent` tool every time the eve agent wants to use it.

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
