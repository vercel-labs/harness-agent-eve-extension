import type { StandardJSONSchemaV1 } from "@standard-schema/spec";

export type HarnessAgentHarness =
  | "claude-code"
  | "cline"
  | "codex"
  | "cursor"
  | "deepagents"
  | "fx"
  | "grok-build"
  | "opencode"
  | "pi";

export interface HarnessAgentSkillFile {
  readonly content: string;
  readonly path: string;
}

export interface HarnessAgentSkill {
  readonly content: string;
  readonly description: string;
  readonly files?: readonly HarnessAgentSkillFile[];
  readonly name: string;
}

export interface HarnessAgentSettings {
  readonly id?: string;
  readonly instructions?: string;
  readonly skills?: readonly HarnessAgentSkill[];
  readonly workingDirectory?: string;
}

export interface DynamicHarnessAgentToolInput extends HarnessAgentSettings {
  readonly harness: HarnessAgentHarness;
  readonly model?: string;
  readonly task: string;
}

export interface FixedHarnessAgentToolInput {
  readonly harness: HarnessAgentHarness;
  readonly task: string;
}

export interface CreateFixedHarnessAgentToolSettings<
  TOutputSchema extends
    | StandardJSONSchemaV1<unknown, unknown>
    | undefined = undefined,
> extends HarnessAgentSettings {
  /** Model-facing description for this preconfigured HarnessAgent tool. */
  readonly description: string;
  /** Harnesses exposed to the calling model. Defaults to all supported harnesses. */
  readonly harnesses?: "all" | readonly HarnessAgentHarness[];
  /** Optional model override for each harness. Omitted harnesses use their native default model. */
  readonly models?: Readonly<Partial<Record<HarnessAgentHarness, string>>>;
  /** Structured result required from the harness and returned by this eve tool. */
  readonly outputSchema?: TOutputSchema;
}
