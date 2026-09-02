import type { HarnessV1CredentialForwarding } from "@ai-sdk/harness";

/**
 * Builds the harness `credentialForwarding` callback for manual brokering.
 *
 * The configured map is keyed by the source credential's host environment
 * variable name. A direct name match takes precedence. Otherwise the callback
 * compares the value an adapter wants to forward with the current host value
 * of every configured source variable. This also replaces credentials that an
 * adapter forwards under an alias, such as `AI_GATEWAY_API_KEY` becoming
 * `CODEX_API_KEY`.
 *
 * Host values are read when the callback runs so replacement follows the
 * credential the adapter actually resolved. If one real value belongs to
 * several configured source variables, all of them must specify the same
 * sandbox value; otherwise the alias cannot be attributed safely.
 */
export function createManualCredentialForwarding(input: {
  readonly sandboxCredentialOverrides: Readonly<Record<string, string>>;
}): HarnessV1CredentialForwarding {
  const entries = Object.entries(input.sandboxCredentialOverrides);
  const byName = new Map(entries);

  return ({ credential, environmentVariableName }) => {
    const byNameReplacement = byName.get(environmentVariableName);
    if (byNameReplacement !== undefined) {
      return byNameReplacement;
    }

    const matches = new Map<string, string[]>();
    for (const [configuredName, sandboxCredential] of entries) {
      const hostValue = process.env[configuredName];
      if (
        hostValue !== undefined &&
        hostValue.length > 0 &&
        hostValue === credential
      ) {
        const names = matches.get(sandboxCredential) ?? [];
        names.push(configuredName);
        matches.set(sandboxCredential, names);
      }
    }

    if (matches.size === 1) {
      return matches.keys().next().value as string;
    }
    if (matches.size > 1) {
      const matchingNames = [...matches.values()].flat().sort().join(", ");
      throw new Error(
        `Cannot choose a sandbox credential for ${environmentVariableName}: the host credential matches multiple configured variables with different overrides (${matchingNames}).`
      );
    }

    return credential;
  };
}
