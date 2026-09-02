import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import extension from "../extension";
import { HARNESS_AGENT_HARNESSES } from "../lib/harness-agent/adapter";
import {
  createFixedHarnessAgentToolInputSchema,
  executeFixedHarnessAgentTool,
} from "../lib/harness-agent/tool";
import type { HarnessAgentHarness } from "../lib/harness-agent/types";

/**
 * Exposes one HarnessAgent tool per `fixedHarnessAgentTools` entry in the
 * extension config. Each entry becomes a tool named by its `name`, with its
 * description, enabled harnesses, per-harness models, instructions, skills,
 * and working directory fixed from the config; the calling model only chooses
 * the task and (among the enabled harnesses) the harness.
 *
 * When `fixedHarnessAgentTools` is unset or empty, the resolver returns `null`
 * and no tools are exposed. The file name does not contribute to the tool
 * names: a map return names each tool by its bare key.
 *
 * The `execute` callbacks are authored inline (delegating to
 * `executeFixedHarnessAgentTool`) so eve can record a durable descriptor for
 * them; a factory-returned `execute` is not transformable and is rejected. The
 * captured per-tool settings are JSON-serializable extension config values.
 */
export default defineDynamic({
  events: {
    "session.started": () => {
      const entries = extension.config.fixedHarnessAgentTools;
      if (entries.length === 0) {
        return null;
      }
      // biome-ignore lint/plugin: Object.fromEntries is the right tool for building a named tool map
      return Object.fromEntries(
        entries.map((entry) => {
          const settings = {
            harnesses: entry.harnesses,
            id: entry.id,
            instructions: entry.instructions,
            models: entry.models,
            skills: entry.skills,
            workingDirectory: entry.workingDirectory,
          };
          const enabledHarnesses = resolveEnabledHarnessNames(
            settings.harnesses
          );
          return [
            entry.name,
            defineTool({
              approval: always(),
              description: entry.description,
              // biome-ignore lint/plugin: eve ToolDefinition execute signature is (input, ctx)
              async execute(input, ctx) {
                return await executeFixedHarnessAgentTool({
                  abortSignal: ctx.abortSignal,
                  credentialBrokering: extension.config.credentialBrokering,
                  sandbox: await ctx.getSandbox(),
                  settings,
                  toolInput: input,
                });
              },
              inputSchema:
                createFixedHarnessAgentToolInputSchema(enabledHarnesses),
            }),
          ];
        })
      );
    },
  },
});

function resolveEnabledHarnessNames(
  harnesses: "all" | readonly HarnessAgentHarness[] | undefined
): [HarnessAgentHarness, ...HarnessAgentHarness[]] {
  if (harnesses === undefined || harnesses === "all") {
    return [...HARNESS_AGENT_HARNESSES];
  }
  return [...new Set(harnesses)] as [
    HarnessAgentHarness,
    ...HarnessAgentHarness[],
  ];
}
