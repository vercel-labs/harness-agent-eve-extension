import type {
  HarnessV1CredentialForwarding,
  HarnessV1RequestTransformation,
} from "@ai-sdk/harness";
import { z } from "zod";

import { createManualCredentialForwarding } from "./credential-forwarding";

const sandboxCredentialOverridesSchema = z
  .record(z.string().min(1), z.string().min(1))
  .refine((overrides) => Object.keys(overrides).length > 0, {
    message:
      "Manual credential brokering requires at least one sandbox credential override.",
  });

export const CREDENTIAL_BROKERING_SCHEMA = z
  .discriminatedUnion("mode", [
    z.strictObject({ mode: z.literal("none") }),
    z.strictObject({ mode: z.literal("auto") }),
    z.strictObject({
      mode: z.literal("manual"),
      sandboxCredentialOverrides: sandboxCredentialOverridesSchema,
    }),
  ])
  .default({ mode: "none" });

export type CredentialBrokering = z.infer<typeof CREDENTIAL_BROKERING_SCHEMA>;

export interface HarnessRunCredentialBrokering {
  readonly addRequestTransformations?: (
    transformations: readonly HarnessV1RequestTransformation[]
  ) => PromiseLike<void>;
  readonly cleanup: () => Promise<void>;
  readonly credentialForwarding?: HarnessV1CredentialForwarding;
}

export async function configureCredentialBrokeringForHarnessRun(input: {
  readonly credentialBrokering: CredentialBrokering;
  readonly vercelSandbox: Awaited<
    ReturnType<typeof import("@vercel/sandbox-drives")["Sandbox"]["get"]>
  >;
}): Promise<HarnessRunCredentialBrokering> {
  switch (input.credentialBrokering.mode) {
    case "none":
      return { cleanup: noCleanup };
    case "manual":
      return {
        cleanup: noCleanup,
        credentialForwarding: createManualCredentialForwarding({
          sandboxCredentialOverrides:
            input.credentialBrokering.sandboxCredentialOverrides,
        }),
      };
    case "auto": {
      const { configureVercelCredentialBrokeringForRun } = await import(
        "./vercel-credential-brokering"
      );
      const brokering = await configureVercelCredentialBrokeringForRun({
        vercelSandbox: input.vercelSandbox,
      });
      return {
        addRequestTransformations: brokering.addRequestTransformations,
        cleanup: brokering.cleanup,
      };
    }
    default:
      throw new Error("Unknown credential brokering mode.");
  }
}

function noCleanup(): Promise<void> {
  return Promise.resolve();
}
