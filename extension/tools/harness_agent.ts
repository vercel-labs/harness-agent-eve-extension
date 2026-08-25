import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import extension from "../extension";

/**
 * The `harness_agent` tool is only exposed when the consumer mounts the
 * extension with `exposeDynamicHarnessAgentTool: true`. The dynamic resolver
 * returns the tool definition when the flag is set, and `null` otherwise,
 * which omits the tool from the model-visible tool set.
 */
export default defineDynamic({
  events: {
    "session.started": () =>
      extension.config.exposeDynamicHarnessAgentTool
        ? defineTool({
            description:
              "Delegate a task to a dynamic harness agent. Dummy implementation for now.",
            inputSchema: z.object({
              task: z.string(),
            }),
            execute: ({ task }) => ({
              task,
              status: "not_implemented",
              message:
                "The harness_agent tool is a placeholder and does not run a harness agent yet.",
            }),
          })
        : null,
  },
});
