import { defineExtension } from "eve/extension";
import { z } from "zod";
import { CREDENTIAL_BROKERING_SCHEMA } from "./lib/harness-agent/credential-brokering";
import {
  HARNESS_AGENT_HARNESSES_SCHEMA,
  HARNESS_AGENT_MODELS_SCHEMA,
  HARNESS_AGENT_SETTINGS_SHAPE,
} from "./lib/harness-agent/tool";

export default defineExtension({
  config: z.object({
    credentialBrokering: CREDENTIAL_BROKERING_SCHEMA,
    // Optional model-facing description override for the dynamic `harness_agent` tool.
    dynamicHarnessAgentToolDescription: z.string().optional(),
    // When true, the extension exposes the dynamic `harness_agent` tool.
    exposeDynamicHarnessAgentTool: z.boolean().default(false),
    // Preconfigured HarnessAgent tools for specific purposes. Each entry
    // exposes one additional tool, named by its `name`, whose HarnessAgent
    // settings are fixed from this configuration.
    fixedHarnessAgentTools: z
      .array(
        z.strictObject({
          description: z
            .string()
            .describe("Model-facing description for this tool."),
          harnesses: HARNESS_AGENT_HARNESSES_SCHEMA.optional(),
          models: HARNESS_AGENT_MODELS_SCHEMA.optional(),
          // Tool name exposed to the agent. Use only lowercase letters,
          // digits, and underscores, e.g. `code_review_harness_agent`.
          name: z
            .string()
            .regex(/^[a-z0-9_]+$/)
            .describe("Name of the exposed tool."),
          ...HARNESS_AGENT_SETTINGS_SHAPE,
        })
      )
      .default([]),
  }),
});
