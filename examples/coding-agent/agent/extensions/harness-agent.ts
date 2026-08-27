import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: true,
  fixedHarnessAgentTools: [
    {
      name: "explain_code",
      description:
        "Explain how code in the `ms` repository works, without modifying anything. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      instructions: [
        "Explain the code the task asks about, concisely and in plain language.",
        "Do not modify, create, or delete any files. Read-only inspection only.",
        "Keep the answer focused; skip unrelated details.",
      ].join("\n"),
      harnesses: ["fx", "grok-build", "codex"],
      workingDirectory: "ms",
    },
    {
      name: "review_code",
      description:
        "Review code in the `ms` repository and provide an assessment. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      instructions: [
        "Review the code the task asks about. Do not modify any files.",
        "Start your reply with exactly one assessment line: APPROVED, NEUTRAL, or CHANGES-REQUESTED.",
        "After the assessment, briefly list the findings that led to it.",
      ].join("\n"),
      harnesses: ["grok-build", "codex", "cursor"],
      workingDirectory: "ms",
    },
    {
      name: "security_audit",
      description:
        "Audit the `ms` repository for potential security flaws. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      instructions: [
        "Perform a holistic security review of the repository. Do not modify any files.",
        "Look for common issues such as injection, unsafe input handling, and exposed secrets.",
        "Start your reply with exactly one assessment line: PASS, NEUTRAL, or FAIL.",
        "After the assessment, briefly list each potential flaw and where it lives.",
      ].join("\n"),
      harnesses: ["claude-code", "codex", "cursor"],
      workingDirectory: "ms",
    },
  ],
});
