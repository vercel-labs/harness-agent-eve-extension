import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import extension from "../extension";
import { DEFAULT_DYNAMIC_HARNESS_AGENT_TOOL_DESCRIPTION } from "../lib/harness-agent/harness-agent";
import {
  DYNAMIC_HARNESS_AGENT_TOOL_INPUT_SCHEMA,
  executeDynamicHarnessAgentTool,
} from "../lib/harness-agent/tool";

/**
 * The `harness_agent` tool is only exposed when the consumer mounts the
 * extension with `exposeDynamicHarnessAgentTool: true`. The dynamic resolver
 * returns the tool definition when the flag is set, and `null` otherwise,
 * which omits the tool from the model-visible tool set.
 *
 * When the consumer provides `dynamicHarnessAgentToolDescription`, it is used
 * as the tool's model-facing description; otherwise the default description
 * applies.
 *
 * The `execute` callback is authored inline (delegating to
 * `executeDynamicHarnessAgentTool`) so eve can record a durable descriptor for
 * it; a factory-returned `execute` is not transformable and is rejected.
 */
export default defineDynamic({
  events: {
    "session.started": () => {
      if (!extension.config.exposeDynamicHarnessAgentTool) {
        return null;
      }
      return defineTool({
        approval: always(),
        description:
          extension.config.dynamicHarnessAgentToolDescription ??
          DEFAULT_DYNAMIC_HARNESS_AGENT_TOOL_DESCRIPTION,
        inputSchema: DYNAMIC_HARNESS_AGENT_TOOL_INPUT_SCHEMA,
        async execute(input, ctx) {
          return await executeDynamicHarnessAgentTool({
            abortSignal: ctx.abortSignal,
            sandbox: await ctx.getSandbox(),
            toolInput: input,
          });
        },
      });
    },
  },
});
