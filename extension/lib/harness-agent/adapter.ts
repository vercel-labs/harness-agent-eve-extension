import type { HarnessV1CredentialForwarding } from "@ai-sdk/harness";
import type { HarnessAgentAdapter } from "@ai-sdk/harness/agent";

import type { HarnessAgentHarness } from "./types";

/**
 * These are plain package imports. Harnesses whose bootstrap resolves
 * `dist/bridge/` assets relative to `import.meta.url` must keep their normal
 * Node.js package layout at runtime (bundling would break that resolution);
 * those are declared in `eve.extension.externalDependencies` (see
 * `package.json`). Harnesses that read no bridge assets are bundled normally.
 */

export const HARNESS_AGENT_HARNESSES = [
  "claude-code",
  "cline",
  "codex",
  "cursor",
  "deepagents",
  "fx",
  "grok-build",
  "opencode",
  "pi",
] as const satisfies readonly HarnessAgentHarness[];

const BRIDGE_HARNESSES = new Set<HarnessAgentHarness>([
  "claude-code",
  "codex",
  "cursor",
  "deepagents",
  "fx",
  "grok-build",
  "opencode",
]);

export function harnessUsesBridge(harness: HarnessAgentHarness): boolean {
  return BRIDGE_HARNESSES.has(harness);
}

export interface HarnessBridgeSettings {
  readonly port: number;
  readonly portEndpoint: { readonly url: string };
}

export async function loadHarnessAdapter(input: {
  readonly bridge?: HarnessBridgeSettings;
  readonly credentialForwarding?: HarnessV1CredentialForwarding;
  readonly harness: HarnessAgentHarness;
  readonly model?: string;
}): Promise<HarnessAgentAdapter> {
  const modelSettings =
    input.model === undefined ? undefined : { model: input.model };

  // biome-ignore lint/style/useDefaultSwitchClause: exhaustive switch over HarnessAgentHarness union
  switch (input.harness) {
    case "claude-code":
      return (await import("@ai-sdk/harness-claude-code")).createClaudeCode(
        bridgeSettings(input)
      );
    case "cline":
      return (await import("@ai-sdk/harness-cline")).createCline(
        input.model === undefined ? undefined : { modelId: input.model }
      );
    case "codex":
      return (await import("@ai-sdk/harness-codex")).createCodex(
        bridgeSettings(input)
      );
    case "cursor":
      return (await import("@ai-sdk/harness-cursor")).createCursor(
        bridgeSettings(input)
      );
    case "deepagents":
      return (await import("@ai-sdk/harness-deepagents")).createDeepAgents(
        bridgeSettings(input)
      );
    case "fx":
      return (await import("@ai-sdk/harness-fx")).createFx(
        bridgeSettings(input)
      );
    case "grok-build":
      return (await import("@ai-sdk/harness-grok-build")).createGrokBuild(
        bridgeSettings(input)
      );
    case "opencode":
      return (await import("@ai-sdk/harness-opencode")).createOpenCode(
        bridgeSettings(input)
      );
    case "pi":
      return (await import("@ai-sdk/harness-pi")).createPi(modelSettings);
  }
}

function bridgeSettings(input: {
  readonly bridge?: HarnessBridgeSettings;
  readonly credentialForwarding?: HarnessV1CredentialForwarding;
  readonly harness: HarnessAgentHarness;
  readonly model?: string;
}): HarnessBridgeSettings & {
  readonly credentialForwarding?: HarnessV1CredentialForwarding;
  readonly model?: string;
} {
  if (input.bridge === undefined) {
    throw new Error(
      `The ${input.harness} harness requires an acquired sandbox port.`
    );
  }
  return {
    ...input.bridge,
    ...(input.credentialForwarding === undefined
      ? {}
      : { credentialForwarding: input.credentialForwarding }),
    ...(input.model === undefined ? {} : { model: input.model }),
  };
}
