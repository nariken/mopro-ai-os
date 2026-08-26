import { describe, expect, it } from "vitest";
import { scanGadgetFilesForSecrets } from "../src/gadget-secret-scan.js";

describe("scanGadgetFilesForSecrets", () => {
  it("accepts normal Gadget code and placeholders", () => {
    let files = new Map([
      ["client.js", `const label = "API key";\nconst apiKey = "YOUR_API_KEY";`],
      ["README.md", "Synthetic Sample. No external credentials are required."],
    ]);
    expect(scanGadgetFilesForSecrets(files)).toEqual([]);
  });

  it.each([
    ["private key", "-----BEGIN PRIVATE KEY-----\\nabc"],
    ["AWS access key", "const id = 'AKIA1234567890ABCDEF';"],
    ["GitHub token", `const token = "ghp_${"a".repeat(36)}";`],
    ["Slack token", `const token = "xoxb-${"1".repeat(12)}-${"a".repeat(24)}";`],
    ["OpenAI API key", `const token = "sk-proj-${"a".repeat(32)}";`],
    ["assigned credential", `const clientSecret = "${"s".repeat(24)}";`],
  ])("detects %s without returning its value", (kind, content) => {
    let findings = scanGadgetFilesForSecrets(new Map([["server.js", `safe();\n${content}`]]));
    expect(findings).toEqual([{ path: "server.js", line: 2, kind }]);
    expect(JSON.stringify(findings)).not.toContain(content);
  });
});
