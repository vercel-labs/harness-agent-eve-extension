import { HarnessAgent } from "@ai-sdk/harness/agent";
import { type FlexibleSchema, Output } from "ai";
import type { SandboxSession } from "eve/sandbox";

import { loadHarnessAdapter } from "./adapter";
import type { CredentialBrokering } from "./credential-brokering";
import { createHarnessSandboxHandle } from "./sandbox-session";
import type { HarnessAgentHarness, HarnessAgentSettings } from "./types";

export async function runHarnessAgent<TOutput = string>(input: {
  readonly abortSignal?: AbortSignal;
  readonly credentialBrokering: CredentialBrokering;
  readonly harness: HarnessAgentHarness;
  readonly model?: string;
  readonly outputSchema?: unknown;
  readonly sandbox: SandboxSession;
  readonly settings: HarnessAgentSettings;
  readonly task: string;
}): Promise<TOutput> {
  const workDir = resolveHarnessWorkDir(input.settings.workingDirectory);
  const sandboxHandle = await createHarnessSandboxHandle({
    credentialBrokering: input.credentialBrokering,
    harness: input.harness,
    sandbox: input.sandbox,
  });
  let session: Awaited<ReturnType<HarnessAgent["createSession"]>> | undefined;
  let output: TOutput;

  try {
    const harness = await loadHarnessAdapter({
      bridge: sandboxHandle.bridge,
      credentialForwarding: sandboxHandle.credentialForwarding,
      harness: input.harness,
      model: input.model,
    });
    const agent = new HarnessAgent({
      harness,
      id: input.settings.id,
      instructions: input.settings.instructions,
      output:
        input.outputSchema === undefined
          ? undefined
          : Output.object({
              schema: input.outputSchema as FlexibleSchema<unknown>,
            }),
      permissionMode: "allow-all",
      sandboxConfig: { workDir },
      skills: input.settings.skills,
    });
    session = await agent.createSession({
      abortSignal: input.abortSignal,
      sandboxSession: sandboxHandle.session,
    });
    const result = await agent.generate({
      abortSignal: input.abortSignal,
      prompt: input.task,
      session,
    });
    output = (
      input.outputSchema === undefined ? result.text : result.output
    ) as TOutput;
  } catch (error) {
    const failures = await cleanupHarnessInvocation({
      dispose: sandboxHandle.dispose,
      session,
    });
    if (failures.length > 0) {
      throw createHarnessInvocationFailure({ error, failures });
    }
    throw error;
  }

  const failures = await cleanupHarnessInvocation({
    dispose: sandboxHandle.dispose,
    session,
  });
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      "Failed to clean up the HarnessAgent invocation."
    );
  }
  return output;
}

function createHarnessInvocationFailure(input: {
  readonly error: unknown;
  readonly failures: readonly unknown[];
}): AggregateError {
  return new AggregateError(
    [input.error, ...input.failures],
    "The HarnessAgent invocation failed and could not be fully cleaned up.",
    { cause: input.error }
  );
}

async function cleanupHarnessInvocation(input: {
  readonly dispose: () => Promise<void>;
  readonly session:
    | Awaited<ReturnType<HarnessAgent["createSession"]>>
    | undefined;
}): Promise<unknown[]> {
  const failures: unknown[] = [];
  try {
    await input.session?.destroy();
  } catch (error) {
    failures.push(error);
  }
  try {
    await input.dispose();
  } catch (error) {
    failures.push(error);
  }
  return failures;
}

const LEADING_DOT_SLASH = /^\.\//;

function resolveHarnessWorkDir(workingDirectory: string | undefined): string {
  if (workingDirectory === undefined || workingDirectory === ".") {
    return "workspace";
  }
  if (
    workingDirectory.startsWith("/") ||
    workingDirectory.split("/").some((segment) => segment === "..")
  ) {
    throw new Error(
      "HarnessAgent workingDirectory must stay within the eve workspace."
    );
  }
  return `workspace/${workingDirectory.replace(LEADING_DOT_SLASH, "")}`;
}
