import { randomUUID } from "node:crypto";

import type { SandboxSession } from "eve/sandbox";

import type { HarnessBridgeSettings } from "./adapter";
import { harnessUsesBridge } from "./adapter";
import {
  type CredentialBrokering,
  configureCredentialBrokeringForHarnessRun,
} from "./credential-brokering";
import type { HarnessAgentHarness } from "./types";

const HARNESS_ROOT = "/workspace/.eve-harness";
const HARNESS_TEMP = `${HARNESS_ROOT}/tmp`;

type VercelSandbox = Awaited<
  ReturnType<typeof import("@vercel/sandbox-drives")["Sandbox"]["get"]>
>;

type HarnessSandboxSession = Omit<SandboxSession, "setNetworkPolicy"> & {
  readonly addRequestTransformations?: (
    transformations: readonly import("@ai-sdk/harness").HarnessV1RequestTransformation[]
  ) => PromiseLike<void>;
  readonly description: string;
  readonly defaultWorkingDirectory: string;
};

export interface HarnessSandboxHandle {
  readonly bridge?: HarnessBridgeSettings;
  readonly credentialForwarding?: import("@ai-sdk/harness").HarnessV1CredentialForwarding;
  readonly dispose: () => Promise<void>;
  readonly session: HarnessSandboxSession;
}

export async function createHarnessSandboxHandle(input: {
  readonly credentialBrokering: CredentialBrokering;
  readonly harness: HarnessAgentHarness;
  readonly sandbox: SandboxSession;
}): Promise<HarnessSandboxHandle> {
  const session = adaptSandboxSession(input.sandbox);
  await prepareHarnessWorkspace(session);

  if (!harnessUsesBridge(input.harness)) {
    return {
      dispose: noCleanup,
      session,
    };
  }

  const vercelSandbox = await resolveVercelSandbox({
    harness: input.harness,
    sandbox: input.sandbox,
  });
  const ports = resolveHarnessPorts({
    harness: input.harness,
    vercelSandbox,
  });
  const credentialBrokering = await configureCredentialBrokeringForHarnessRun({
    credentialBrokering: input.credentialBrokering,
    vercelSandbox,
  });
  try {
    const bridgeLease = await reserveHarnessBridge({
      ports,
      session,
      vercelSandbox,
    });
    return {
      bridge: bridgeLease.settings,
      credentialForwarding: credentialBrokering.credentialForwarding,
      dispose: async () => {
        const failures = await runCleanupOperations([
          bridgeLease.release,
          credentialBrokering.cleanup,
        ]);
        if (failures.length > 0) {
          throw new AggregateError(
            failures,
            "Failed to release HarnessAgent sandbox resources."
          );
        }
      },
      session: addRequestTransformations({
        addRequestTransformations:
          credentialBrokering.addRequestTransformations,
        session,
      }),
    };
  } catch (error) {
    const cleanupFailures = await runCleanupOperations([
      credentialBrokering.cleanup,
    ]);
    if (cleanupFailures.length > 0) {
      throw createSandboxSetupFailure({ error, failures: cleanupFailures });
    }
    throw error;
  }
}

function createSandboxSetupFailure(input: {
  readonly error: unknown;
  readonly failures: readonly unknown[];
}): AggregateError {
  return new AggregateError(
    [input.error, ...input.failures],
    "Failed to configure the HarnessAgent sandbox and roll back credential brokering.",
    { cause: input.error }
  );
}

function adaptSandboxSession(sandbox: SandboxSession): HarnessSandboxSession {
  return {
    defaultWorkingDirectory: HARNESS_ROOT,
    description:
      "An eve sandbox with the agent workspace mounted at /workspace.",
    id: sandbox.id,
    readBinaryFile: sandbox.readBinaryFile,
    readFile: sandbox.readFile,
    readTextFile: sandbox.readTextFile,
    removePath: sandbox.removePath,
    resolvePath: sandbox.resolvePath,
    async run(options) {
      return await sandbox.run({
        ...options,
        env: { ...options.env, TMPDIR: HARNESS_TEMP },
      });
    },
    async spawn(options) {
      return await sandbox.spawn({
        ...options,
        env: { ...options.env, TMPDIR: HARNESS_TEMP },
      });
    },
    writeBinaryFile: sandbox.writeBinaryFile,
    writeFile: sandbox.writeFile,
    writeTextFile: sandbox.writeTextFile,
  };
}

function addRequestTransformations(input: {
  readonly addRequestTransformations:
    | ((
        transformations: readonly import("@ai-sdk/harness").HarnessV1RequestTransformation[]
      ) => PromiseLike<void>)
    | undefined;
  readonly session: HarnessSandboxSession;
}): HarnessSandboxSession {
  if (input.addRequestTransformations === undefined) {
    return input.session;
  }
  return {
    ...input.session,
    addRequestTransformations: input.addRequestTransformations,
  };
}

async function runCleanupOperations(
  operations: readonly (() => Promise<void>)[]
): Promise<unknown[]> {
  const failures: unknown[] = [];
  let completion = Promise.resolve();
  for (const operation of operations) {
    completion = completion
      .then(async () => await operation())
      .catch((error: unknown) => {
        failures.push(error);
      });
  }
  await completion;
  return failures;
}

function noCleanup(): Promise<void> {
  return Promise.resolve();
}

async function resolveVercelSandbox(input: {
  readonly harness: HarnessAgentHarness;
  readonly sandbox: SandboxSession;
}): Promise<VercelSandbox> {
  const { Sandbox } = await import("@vercel/sandbox-drives");
  try {
    return await Sandbox.get({ name: input.sandbox.id, resume: false });
  } catch (error) {
    throw new Error(
      `The ${input.harness} harness requires the current eve sandbox to be a Vercel Sandbox with an exposed port.`,
      { cause: error }
    );
  }
}

function resolveHarnessPorts(input: {
  readonly harness: HarnessAgentHarness;
  readonly vercelSandbox: VercelSandbox;
}): readonly number[] {
  const ports = input.vercelSandbox.routes.map((route) => route.port);
  if (ports.length === 0) {
    throw new Error(
      `The ${input.harness} harness requires an exposed Vercel Sandbox port. Configure the sandbox with a ports array.`
    );
  }
  return ports;
}

async function reserveHarnessBridge(input: {
  readonly ports: readonly number[];
  readonly session: Pick<SandboxSession, "run">;
  readonly vercelSandbox: VercelSandbox;
}): Promise<{
  readonly settings: HarnessBridgeSettings;
  readonly release: () => Promise<void>;
}> {
  const lease = await reserveHarnessPort({
    ports: input.ports,
    sandbox: input.session,
  });
  try {
    const { port } = lease;
    const url = new URL(input.vercelSandbox.domain(port));
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return {
      release: lease.release,
      settings: { port, portEndpoint: { url: url.toString() } },
    };
  } catch (error) {
    try {
      await lease.release();
    } catch (releaseError) {
      throw createBridgeSetupFailure({ error, releaseError });
    }
    throw error;
  }
}

function createBridgeSetupFailure(input: {
  readonly error: unknown;
  readonly releaseError: unknown;
}): AggregateError {
  return new AggregateError(
    [input.error, input.releaseError],
    "Failed to configure the HarnessAgent bridge and release its sandbox port.",
    { cause: input.error }
  );
}

async function reserveHarnessPort(input: {
  readonly ports: readonly number[];
  readonly sandbox: Pick<SandboxSession, "run">;
}): Promise<{ readonly port: number; readonly release: () => Promise<void> }> {
  const owner = randomUUID();
  const result = await input.sandbox.run({
    command:
      `root=${HARNESS_ROOT}/ports; mkdir -p "$root"; ` +
      "for port in $EVE_HARNESS_PORTS; do " +
      `node -e 'const net=require("node:net"); const server=net.createServer(); ` +
      `server.unref(); server.once("error",()=>process.exit(1)); ` +
      `server.listen(Number(process.argv[1]),"0.0.0.0",()=>server.close(()=>process.exit(0)))' "$port" || continue; ` +
      `if mkdir "$root/$port" 2>/dev/null; then ` +
      `printf '%s' "$EVE_HARNESS_PORT_OWNER" > "$root/$port/owner"; ` +
      `printf '%s' "$port"; exit 0; ` +
      "fi; done; exit 75",
    env: {
      EVE_HARNESS_PORT_OWNER: owner,
      EVE_HARNESS_PORTS: input.ports.join(" "),
    },
  });
  const port = Number(result.stdout.trim());
  if (result.exitCode !== 0 || !input.ports.includes(port)) {
    throw new Error(
      "No exposed Vercel Sandbox port is available for this HarnessAgent invocation."
    );
  }

  return {
    port,
    async release() {
      const release = await input.sandbox.run({
        command:
          `root=${HARNESS_ROOT}/ports/${port}; ` +
          `owner=$(cat "$root/owner" 2>/dev/null); ` +
          `if [ "$owner" = "$EVE_HARNESS_PORT_OWNER" ]; then ` +
          `rm -f "$root/owner" && rmdir "$root"; fi`,
        env: { EVE_HARNESS_PORT_OWNER: owner },
      });
      if (release.exitCode !== 0) {
        throw new Error(
          `Failed to release HarnessAgent sandbox port ${port}: ${release.stderr || release.stdout}`
        );
      }
    },
  };
}

async function prepareHarnessWorkspace(
  sandbox: Pick<SandboxSession, "run">
): Promise<void> {
  const result = await sandbox.run({
    command:
      `mkdir -p ${HARNESS_TEMP} && ` +
      `if [ ! -e ${HARNESS_ROOT}/workspace ]; then ln -s /workspace ${HARNESS_ROOT}/workspace; fi && ` +
      `test "$(readlink -f ${HARNESS_ROOT}/workspace)" = /workspace`,
    workingDirectory: "/workspace",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to prepare the harness workspace inside the eve sandbox: ${result.stderr || result.stdout}`
    );
  }
}
