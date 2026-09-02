import harnessAgent from "harness-agent-eve-extension";

export default harnessAgent({
  exposeDynamicHarnessAgentTool: false,
  fixedHarnessAgentTools: [
    {
      description:
        "Explain how code in the `ms` repository works, without modifying anything. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      harnesses: ["fx", "grok-build", "codex"],
      instructions: [
        "Explain the code the task asks about, concisely and in plain language.",
        "Do not modify, create, or delete any files. Read-only inspection only.",
        "Keep the answer focused; skip unrelated details.",
      ].join("\n"),
      name: "explain_code",
      workingDirectory: "ms",
    },
    {
      description:
        "Implement requested code changes in the `ms` repository. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      harnesses: ["claude-code", "codex", "cursor"],
      instructions: [
        "Implement the requested change directly in the repository.",
        "Inspect the relevant code before editing and preserve unrelated changes.",
        "Run focused validation for the files you change when practical.",
        "Briefly summarize what you changed and report the validation results.",
      ].join("\n"),
      name: "write_code",
      workingDirectory: "ms",
    },
    {
      description:
        "Review code in the `ms` repository and provide an assessment. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      harnesses: ["grok-build", "codex", "cursor"],
      instructions: [
        "Review the code the task asks about. Do not modify any files.",
        "Start your reply with exactly one assessment line: APPROVED, NEUTRAL, or CHANGES-REQUESTED.",
        "After the assessment, briefly list the findings that led to it.",
      ].join("\n"),
      name: "review_code",
      workingDirectory: "ms",
    },
    {
      description:
        "Audit the `ms` repository for potential security flaws. " +
        "No need to mention the `ms` project folder explicitly in the task.",
      harnesses: ["claude-code", "codex", "cursor"],
      instructions: [
        "Perform a holistic security review of the repository. Do not modify any files.",
        "Look for common issues such as injection, unsafe input handling, and exposed secrets.",
        "Start your reply with exactly one assessment line: PASS, NEUTRAL, or FAIL.",
        "After the assessment, briefly list each potential flaw and where it lives.",
      ].join("\n"),
      name: "security_audit",
      workingDirectory: "ms",
    },
  ],
});
