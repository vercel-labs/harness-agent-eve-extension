import { defineExtension } from "eve/extension";
import { z } from "zod";

import {
  HARNESS_AGENT_HARNESSES_SCHEMA,
  HARNESS_AGENT_MODELS_SCHEMA,
  HARNESS_AGENT_SETTINGS_SHAPE,
} from "./lib/harness-agent/tool";

export default defineExtension({
  config: z.object({
    // When true, the extension exposes the dynamic `harness_agent` tool.
    exposeDynamicHarnessAgentTool: z.boolean().default(false),
    // Optional model-facing description override for the dynamic `harness_agent` tool.
    dynamicHarnessAgentToolDescription: z.string().optional(),
    // Preconfigured HarnessAgent tools for specific purposes. Each entry
    // exposes one additional tool, named by its `name`, whose HarnessAgent
    // settings are fixed from this configuration.
    fixedHarnessAgentTools: z
      .array(
        z.strictObject({
          // Tool name exposed to the agent. Use only lowercase letters,
          // digits, and underscores, e.g. `code_review_harness_agent`.
          name: z
            .string()
            .regex(/^[a-z0-9_]+$/)
            .describe("Name of the exposed tool."),
          description: z.string().describe("Model-facing description for this tool."),
          harnesses: HARNESS_AGENT_HARNESSES_SCHEMA.optional(),
          models: HARNESS_AGENT_MODELS_SCHEMA.optional(),
          ...HARNESS_AGENT_SETTINGS_SHAPE,
        }),
      )
      .default([]),
  }),
});
