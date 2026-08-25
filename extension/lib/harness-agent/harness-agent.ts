import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { ToolDefinition } from "eve/tools";
import { always } from "eve/tools/approval";

import {
  createFixedHarnessAgentToolRuntime,
  DYNAMIC_HARNESS_AGENT_TOOL_INPUT_SCHEMA,
  executeDynamicHarnessAgentTool,
} from "./tool";
import type {
  CreateFixedHarnessAgentToolSettings,
  DynamicHarnessAgentToolInput,
  FixedHarnessAgentToolInput,
} from "./types";

/** Default model-facing description for the flexible HarnessAgent tool. */
export const DEFAULT_DYNAMIC_HARNESS_AGENT_TOOL_DESCRIPTION =
  "Run a coding harness such as Claude Code or Codex in the current eve sandbox to complete a task.";

/** Settings accepted by {@link createDynamicHarnessAgentTool}. */
export interface CreateDynamicHarnessAgentToolSettings {
  /** Model-facing description for the flexible HarnessAgent tool. */
  readonly description?: string;
}

/**
 * Creates a flexible HarnessAgent tool definition. Export it from
 * `agent/tools/harness_agent.ts`; eve derives the runtime name `harness_agent`
 * from that path. Every invocation requires outer tool approval and runs in
 * the current eve sandbox.
 */
export function createDynamicHarnessAgentTool(
  settings: CreateDynamicHarnessAgentToolSettings = {},
): ToolDefinition<DynamicHarnessAgentToolInput, string> {
  return {
    approval: always(),
    description: settings.description ?? DEFAULT_DYNAMIC_HARNESS_AGENT_TOOL_DESCRIPTION,
    async execute(input, ctx) {
      return await executeDynamicHarnessAgentTool({
        abortSignal: ctx.abortSignal,
        sandbox: await ctx.getSandbox(),
        toolInput: input,
      });
    },
    inputSchema: DYNAMIC_HARNESS_AGENT_TOOL_INPUT_SCHEMA,
  };
}

export function createFixedHarnessAgentTool<
  TOutputSchema extends StandardJSONSchemaV1<unknown, unknown>,
>(
  settings: CreateFixedHarnessAgentToolSettings<TOutputSchema> & {
    readonly outputSchema: TOutputSchema;
  },
): ToolDefinition<FixedHarnessAgentToolInput, StandardJSONSchemaV1.InferOutput<TOutputSchema>>;
export function createFixedHarnessAgentTool(
  settings: CreateFixedHarnessAgentToolSettings,
): ToolDefinition<FixedHarnessAgentToolInput, string>;

/**
 * Creates an approval-gated HarnessAgent tool definition whose instructions,
 * skills, working directory, enabled harnesses, and per-harness model defaults
 * are fixed in code. The calling model chooses only the task and harness.
 */
export function createFixedHarnessAgentTool(
  settings: CreateFixedHarnessAgentToolSettings<StandardJSONSchemaV1<unknown, unknown> | undefined>,
): unknown {
  const { description, ...runtimeSettings } = settings;
  const runtime = createFixedHarnessAgentToolRuntime(runtimeSettings);
  const definition: ToolDefinition<FixedHarnessAgentToolInput, unknown> = {
    approval: always(),
    description,
    async execute(input, ctx) {
      return await runtime.execute({
        abortSignal: ctx.abortSignal,
        sandbox: await ctx.getSandbox(),
        toolInput: input,
      });
    },
    inputSchema: runtime.inputSchema,
  };

  return runtime.outputSchema === undefined
    ? definition
    : { ...definition, outputSchema: runtime.outputSchema };
}
