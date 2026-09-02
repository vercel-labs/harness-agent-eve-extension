import { randomUUID } from "node:crypto";

import type { HarnessV1RequestTransformation } from "@ai-sdk/harness";
import type {
  NetworkPolicy,
  Sandbox as VercelSandbox,
} from "@vercel/sandbox-drives";

type SetRequestTransformations = (
  transformations: readonly HarnessV1RequestTransformation[]
) => PromiseLike<void>;

interface RegisteredHarnessRun {
  readonly addRequestTransformations: SetRequestTransformations;
  readonly cleanup: () => Promise<void>;
}

interface VercelCredentialBrokeringRegistry {
  readonly coordinators: Map<string, VercelCredentialBrokeringRegistryEntry>;
}

interface VercelCredentialBrokeringRegistryEntry {
  readonly coordinator: Promise<VercelCredentialBrokeringCoordinator>;
  pendingRegistrations: number;
}

const REGISTRY_KEY = Symbol.for(
  "harness-agent-eve-extension.vercel-credential-brokering"
);

function getRegistry(): VercelCredentialBrokeringRegistry {
  const globals = globalThis as {
    [REGISTRY_KEY]?: VercelCredentialBrokeringRegistry;
  };
  let registry = globals[REGISTRY_KEY];
  if (registry === undefined) {
    registry = { coordinators: new Map() };
    globals[REGISTRY_KEY] = registry;
  }
  return registry;
}

export async function configureVercelCredentialBrokeringForRun(input: {
  readonly vercelSandbox: VercelSandbox;
}): Promise<RegisteredHarnessRun> {
  const registry = getRegistry();
  const sandboxKey = getPhysicalSandboxKey(input.vercelSandbox);
  let entry = registry.coordinators.get(sandboxKey);

  if (entry === undefined) {
    const coordinator = createCoordinator({
      vercelSandbox: input.vercelSandbox,
    });
    entry = { coordinator, pendingRegistrations: 0 };
    registry.coordinators.set(sandboxKey, entry);
    coordinator.catch(() => {
      if (registry.coordinators.get(sandboxKey) === entry) {
        registry.coordinators.delete(sandboxKey);
      }
    });
  }

  entry.pendingRegistrations += 1;
  let coordinator: VercelCredentialBrokeringCoordinator;
  let run: RegisteredHarnessRun;
  try {
    coordinator = await entry.coordinator;
    run = coordinator.registerHarnessRun();
  } finally {
    entry.pendingRegistrations -= 1;
  }
  let cleanedUp = false;

  return {
    addRequestTransformations: run.addRequestTransformations,
    async cleanup() {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      await run.cleanup();
      if (
        coordinator.isIdle() &&
        entry.pendingRegistrations === 0 &&
        registry.coordinators.get(sandboxKey) === entry
      ) {
        registry.coordinators.delete(sandboxKey);
      }
    },
  };
}

export class VercelCredentialBrokeringCoordinator {
  readonly #setRequestTransformations: SetRequestTransformations;
  readonly #transformationsByRun = new Map<
    string,
    HarnessV1RequestTransformation[]
  >();
  #mutationQueue: Promise<void> = Promise.resolve();
  #poisonedBy: unknown;

  constructor(input: {
    readonly setRequestTransformations: SetRequestTransformations;
  }) {
    this.#setRequestTransformations = input.setRequestTransformations;
  }

  registerHarnessRun(): RegisteredHarnessRun {
    this.#throwIfPoisoned();
    const runId = randomUUID();
    this.#transformationsByRun.set(runId, []);
    let registered = true;

    return {
      addRequestTransformations: async (transformations) => {
        if (!registered) {
          throw new Error(
            "Cannot add request transformations after the HarnessAgent run has been cleaned up."
          );
        }
        await this.#enqueueMutation(async () => {
          const current = this.#transformationsByRun.get(runId);
          if (current === undefined) {
            throw new Error(
              "Cannot add request transformations for an unknown HarnessAgent run."
            );
          }
          this.#transformationsByRun.set(
            runId,
            mergeRequestTransformations({
              existing: current,
              incoming: transformations,
            })
          );
          await this.#applyMergedTransformations();
        });
      },
      cleanup: async () => {
        if (!registered) {
          return;
        }
        registered = false;
        await this.#enqueueMutation(async () => {
          this.#transformationsByRun.delete(runId);
          await this.#applyMergedTransformations();
        });
      },
    };
  }

  isIdle(): boolean {
    return this.#transformationsByRun.size === 0;
  }

  #enqueueMutation(operation: () => Promise<void>): Promise<void> {
    const result = this.#mutationQueue.then(async () => {
      this.#throwIfPoisoned();
      try {
        await operation();
      } catch (error) {
        this.#poisonedBy = error;
        throw error;
      }
    });
    this.#mutationQueue = result.catch(() => undefined);
    return result;
  }

  async #applyMergedTransformations(): Promise<void> {
    const transformations: HarnessV1RequestTransformation[] = [];
    for (const runTransformations of this.#transformationsByRun.values()) {
      const merged = mergeRequestTransformations({
        existing: transformations,
        incoming: runTransformations,
      });
      transformations.splice(0, transformations.length, ...merged);
    }
    await this.#setRequestTransformations(transformations);
  }

  #throwIfPoisoned(): void {
    if (this.#poisonedBy !== undefined) {
      throw new Error(
        "Credential brokering for this Vercel Sandbox is unavailable because a network-policy update failed and its resulting state is uncertain.",
        { cause: this.#poisonedBy }
      );
    }
  }
}

async function createCoordinator(input: {
  readonly vercelSandbox: VercelSandbox;
}): Promise<VercelCredentialBrokeringCoordinator> {
  assertNoExistingRequestTransformations(
    input.vercelSandbox.currentSession().networkPolicy ?? "allow-all"
  );

  const { createVercelSandbox } = await import("@ai-sdk/sandbox-vercel");
  const provider = createVercelSandbox({
    /*
     * The eve backend currently uses Vercel Sandbox v2 while the AI SDK
     * package may resolve v3. Both versions expose the runtime methods used by
     * the wrapper, but their private class fields make their TypeScript types
     * nominally incompatible. Keep that compatibility cast at this boundary.
     */
    sandbox: input.vercelSandbox as never,
  });
  const session = await provider.createSession();
  if (session.setRequestTransformations === undefined) {
    throw new Error(
      "The installed AI SDK Vercel Sandbox adapter does not support request transformations."
    );
  }

  return new VercelCredentialBrokeringCoordinator({
    setRequestTransformations: async (transformations) => {
      await session.setRequestTransformations?.(transformations);
    },
  });
}

function getPhysicalSandboxKey(vercelSandbox: VercelSandbox): string {
  const { sessionId } = vercelSandbox.currentSession();
  if (sessionId.length === 0) {
    throw new Error(
      "Cannot coordinate credential brokering without a Vercel Sandbox session ID."
    );
  }
  return `${vercelSandbox.name}:${sessionId}`;
}

export function assertNoExistingRequestTransformations(
  policy: NetworkPolicy
): void {
  if (
    policy === "allow-all" ||
    policy === "deny-all" ||
    policy.allow === undefined ||
    Array.isArray(policy.allow)
  ) {
    return;
  }

  for (const rules of Object.values(policy.allow)) {
    for (const rule of rules) {
      const hasTransformedHeaders =
        rule.transform?.some(
          (transformation) =>
            transformation.headers !== undefined &&
            Object.keys(transformation.headers).length > 0
        ) ?? false;
      if (hasTransformedHeaders) {
        throw new Error(
          'credentialBrokering mode "auto" requires exclusive ownership of Vercel Sandbox request transformations, but the sandbox already has transformed-header rules.'
        );
      }
    }
  }
}

function mergeRequestTransformations(input: {
  readonly existing: readonly HarnessV1RequestTransformation[];
  readonly incoming: readonly HarnessV1RequestTransformation[];
}): HarnessV1RequestTransformation[] {
  const merged = [...input.existing];
  const indexes = new Map(
    merged.map((transformation, index) => [
      getRequestTransformationIdentity(transformation),
      index,
    ])
  );

  for (const transformation of input.incoming) {
    const identity = getRequestTransformationIdentity(transformation);
    const existingIndex = indexes.get(identity);
    if (existingIndex === undefined) {
      indexes.set(identity, merged.length);
      merged.push(transformation);
    } else {
      merged[existingIndex] = transformation;
    }
  }
  return merged;
}

function getRequestTransformationIdentity(
  transformation: HarnessV1RequestTransformation
): string {
  return stableSerialize({
    match: transformation.match,
    transformedHeaderNames: Object.keys(transformation.transform.headers)
      .map((name) => name.toLowerCase())
      .sort(),
  });
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
