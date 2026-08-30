/** A secret-like value found in one Gadget source file. The value itself is never returned. */
export type GadgetSecretFinding = {
  path: string;
  line: number;
  kind: string;
};

type SecretPattern = { kind: string; pattern: RegExp };

const SECRET_PATTERNS: SecretPattern[] = [
  { kind: "private key", pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g },
  { kind: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { kind: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { kind: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { kind: "OpenAI API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  {
    kind: "assigned credential",
    pattern: /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["'`][^"'`\r\n]{16,}["'`]/gi,
  },
];

function lineNumberAt(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * Scan final Gadget files for common credential formats before packaging. Findings identify only
 * the file, line, and credential kind so logs and error messages never repeat the secret value.
 */
export function scanGadgetFilesForSecrets(files: ReadonlyMap<string, string>): GadgetSecretFinding[] {
  let findings: GadgetSecretFinding[] = [];
  for (let [path, content] of files) {
    for (let { kind, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
        findings.push({ path, line: lineNumberAt(content, match.index), kind });
      }
    }
  }
  return findings;
}
