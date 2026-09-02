import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { SandboxSession } from "eve/sandbox";
import { z } from "zod";

import { HARNESS_AGENT_HARNESSES } from "./adapter";
import type { CredentialBrokering } from "./credential-brokering";
import { runHarnessAgent } from "./run";
import type {
  CreateFixedHarnessAgentToolSettings,
  DynamicHarnessAgentToolInput,
  FixedHarnessAgentToolInput,
  HarnessAgentHarness,
} from "./types";

const skillFileSchema = z.strictObject({
  content: z.string(),
  path: z.string(),
});

const skillSchema = z.strictObject({
  content: z.string(),
  description: z.string(),
  files: z.array(skillFileSchema).optional(),
  name: z.string(),
});

/**
 * Zod shape for the serializable {@link HarnessAgentSettings} fields. Shared
 * by the dynamic `harness_agent` tool input and the extension config for
 * preconfigured fixed HarnessAgent tools.
 */
export const HARNESS_AGENT_SETTINGS_SHAPE = {
  id: z
    .string()
    .describe("Optional stable identifier for this HarnessAgent instance.")
    .optional(),
  instructions: z
    .string()
    .describe("Instructions for the selected coding harness.")
    .optional(),
  skills: z
    .array(skillSchema)
    .describe("Skills made available to the selected coding harness.")
    .optional(),
  workingDirectory: z
    .string()
    .describe(
      "Workspace-relative directory in which the coding harness should work."
    )
    .optional(),
};

/** Zod schema for a single supported harness name. */
export const HARNESS_AGENT_HARNESS_SCHEMA = z.enum(HARNESS_AGENT_HARNESSES);

/**
 * Zod schema for the harness allowlist of a fixed HarnessAgent tool: either
 * `"all"` or a non-empty list of supported harnesses.
 */
export const HARNESS_AGENT_HARNESSES_SCHEMA = z.union([
  z.literal("all"),
  z.array(HARNESS_AGENT_HARNESS_SCHEMA).nonempty(),
]);

/** Zod schema for the per-harness model overrides of a fixed HarnessAgent tool. */
export const HARNESS_AGENT_MODELS_SCHEMA = z.partialRecord(
  HARNESS_AGENT_HARNESS_SCHEMA,
  z.string().min(1)
);

export const DYNAMIC_HARNESS_AGENT_TOOL_INPUT_SCHEMA = z.strictObject({
  harness: HARNESS_AGENT_HARNESS_SCHEMA.describe("Coding harness to run."),
  model: z
    .string()
    .describe(
      "Optional model override. Omit this to use the harness's default model."
    )
    .optional(),
  task: z.string().describe("Task for the coding harness to complete."),
  ...HARNESS_AGENT_SETTINGS_SHAPE,
});

type CreateFixedHarnessAgentToolRuntimeSettings = Omit<
  CreateFixedHarnessAgentToolSettings<
    StandardJSONSchemaV1<unknown, unknown> | undefined
  >,
  "description"
>;

export async function executeDynamicHarnessAgentTool(input: {
  readonly abortSignal?: AbortSignal;
  readonly credentialBrokering?: CredentialBrokering;
  readonly sandbox: SandboxSession;
  readonly toolInput: DynamicHarnessAgentToolInput;
}): Promise<string> {
  const { harness, model, task, ...settings } = input.toolInput;
  return await runHarnessAgent<string>({
    abortSignal: input.abortSignal,
    credentialBrokering: input.credentialBrokering ?? { mode: "none" },
    harness,
    model: model === "" ? undefined : model,
    sandbox: input.sandbox,
    settings,
    task,
  });
}

/**
 * Serializable settings accepted by {@link executeFixedHarnessAgentTool}.
 * These mirror `CreateFixedHarnessAgentToolSettings` without an
 * `outputSchema`: preconfigured fixed HarnessAgent tools always return the
 * harness's text output as a string.
 */
export type FixedHarnessAgentToolRuntimeSettings = Omit<
  CreateFixedHarnessAgentToolSettings<undefined>,
  "description" | "outputSchema"
>;

export async function executeFixedHarnessAgentTool(input: {
  readonly abortSignal?: AbortSignal;
  readonly credentialBrokering?: CredentialBrokering;
  readonly sandbox: SandboxSession;
  readonly settings: FixedHarnessAgentToolRuntimeSettings;
  readonly toolInput: FixedHarnessAgentToolInput;
}): Promise<string> {
  const { harnesses, models, ...settings } = input.settings;
  const enabledHarnesses = resolveEnabledHarnesses(harnesses);
  if (!enabledHarnesses.includes(input.toolInput.harness)) {
    throw new Error(
      `Harness "${input.toolInput.harness}" is not enabled for this fixed HarnessAgent tool.`
    );
  }
  validateModels({ enabledHarnesses, models });
  return await runHarnessAgent<string>({
    abortSignal: input.abortSignal,
    credentialBrokering: input.credentialBrokering ?? { mode: "none" },
    harness: input.toolInput.harness,
    model: models?.[input.toolInput.harness],
    sandbox: input.sandbox,
    settings,
    task: input.toolInput.task,
  });
}

/**
 * Zod input schema for a fixed HarnessAgent tool whose enabled harnesses are
 * known in advance.
 */
export function createFixedHarnessAgentToolInputSchema(
  enabledHarnesses: readonly [HarnessAgentHarness, ...HarnessAgentHarness[]]
) {
  return z.strictObject({
    harness: z
      .enum(enabledHarnesses)
      .describe("Preconfigured coding harness to run."),
    task: z.string().describe("Task for the coding harness to complete."),
  });
}

export function createFixedHarnessAgentToolRuntime(
  settings: CreateFixedHarnessAgentToolRuntimeSettings
) {
  const { harnesses, models, outputSchema, ...agentSettings } = settings;
  const enabledHarnesses = resolveEnabledHarnesses(harnesses);
  validateModels({ enabledHarnesses, models });

  return {
    async execute(input: {
      readonly abortSignal?: AbortSignal;
      readonly credentialBrokering?: CredentialBrokering;
      readonly sandbox: SandboxSession;
      readonly toolInput: FixedHarnessAgentToolInput;
    }): Promise<unknown> {
      return await runHarnessAgent({
        abortSignal: input.abortSignal,
        credentialBrokering: input.credentialBrokering ?? { mode: "none" },
        harness: input.toolInput.harness,
        model: models?.[input.toolInput.harness],
        outputSchema,
        sandbox: input.sandbox,
        settings: agentSettings,
        task: input.toolInput.task,
      });
    },
    inputSchema: createFixedHarnessAgentToolInputSchema(
      enabledHarnesses as [HarnessAgentHarness, ...HarnessAgentHarness[]]
    ),
    outputSchema,
  };
}

function resolveEnabledHarnesses(
  harnesses: CreateFixedHarnessAgentToolSettings["harnesses"]
): readonly HarnessAgentHarness[] {
  if (harnesses === undefined || harnesses === "all") {
    return HARNESS_AGENT_HARNESSES;
  }
  if (!Array.isArray(harnesses)) {
    throw new Error(
      'createFixedHarnessAgentTool harnesses must be "all" or an allowlist.'
    );
  }
  const enabled = [...new Set(harnesses)];
  if (enabled.length === 0) {
    throw new Error(
      "createFixedHarnessAgentTool requires at least one enabled harness."
    );
  }
  for (const harness of enabled) {
    if (!HARNESS_AGENT_HARNESSES.includes(harness)) {
      throw new Error(`Unknown HarnessAgent harness "${harness}".`);
    }
  }
  return enabled;
}

function validateModels(input: {
  readonly enabledHarnesses: readonly HarnessAgentHarness[];
  readonly models: CreateFixedHarnessAgentToolSettings["models"];
}): void {
  if (input.models === undefined) {
    return;
  }
  const enabled = new Set(input.enabledHarnesses);
  for (const [harness, model] of Object.entries(input.models)) {
    if (!HARNESS_AGENT_HARNESSES.includes(harness as HarnessAgentHarness)) {
      throw new Error(`Unknown HarnessAgent harness model key "${harness}".`);
    }
    if (!enabled.has(harness as HarnessAgentHarness)) {
      throw new Error(
        `A model was configured for disabled HarnessAgent harness "${harness}".`
      );
    }
    if (typeof model !== "string" || model.trim().length === 0) {
      throw new Error(
        `HarnessAgent model for "${harness}" must be a non-empty string.`
      );
    }
  }
}
