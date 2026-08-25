import { defineExtension } from "eve/extension";
import { z } from "zod";

export default defineExtension({
  config: z.object({
    // When true, the extension exposes the dynamic `harness_agent` tool.
    exposeDynamicHarnessAgentTool: z.boolean().default(false),
    // Optional model-facing description override for the dynamic `harness_agent` tool.
    dynamicHarnessAgentToolDescription: z.string().optional(),
  }),
});
