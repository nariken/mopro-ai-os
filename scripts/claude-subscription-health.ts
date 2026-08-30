import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const METERED_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
] as const;

/** Result of the Claude subscription preflight used by Personal doctor and routing checks. */
export type ClaudeSubscriptionHealth = { ok: boolean; detail: string };

/** Minimal command runner contract used to keep the preflight deterministic in tests. */
export type ClaudeHealthRunner = (
  command: string,
  args: string[],
  options?: { timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

type AuthStatus = {
  loggedIn?: boolean;
  authMethod?: string;
  subscriptionType?: string;
};

/** Return names of environment variables that could bypass subscription-backed Claude access. */
export function meteredClaudeEnvironment(environment: NodeJS.ProcessEnv): string[] {
  return METERED_ENV_KEYS.filter(key => Boolean(environment[key]));
}

/** Parse the JSON emitted by `claude auth status`, rejecting incomplete subscription sessions. */
export function parseClaudeAuthStatus(output: string): ClaudeSubscriptionHealth {
  let status: AuthStatus;
  try {
    status = JSON.parse(output) as AuthStatus;
  } catch {
    return { ok: false, detail: "invalid `claude auth status` response" };
  }
  if (!status.loggedIn) return { ok: false, detail: "Claude CLI is not logged in; run `claude auth login`" };
  if (status.authMethod !== "claude.ai") {
    return { ok: false, detail: `Claude auth method is ${status.authMethod ?? "unknown"}, not claude.ai` };
  }
  let allowed = new Set(["pro", "max", "team", "enterprise"]);
  if (!status.subscriptionType || !allowed.has(status.subscriptionType.toLowerCase())) {
    return { ok: false, detail: `Claude subscription is ${status.subscriptionType ?? "unknown"}` };
  }
  return { ok: true, detail: `claude.ai ${status.subscriptionType}` };
}

async function defaultRunner(
  command: string,
  args: string[],
  options?: { timeout?: number },
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(command, args, {
    encoding: "utf8",
    timeout: options?.timeout,
    env: process.env,
  });
}

/** Verify Keychain persistence, subscription identity, and one real non-tool Claude response. */
export async function checkClaudeSubscription(
  environment: NodeJS.ProcessEnv = process.env,
  runner: ClaudeHealthRunner = defaultRunner,
): Promise<ClaudeSubscriptionHealth> {
  let metered = meteredClaudeEnvironment(environment);
  if (metered.length) {
    return { ok: false, detail: `metered or overriding environment present: ${metered.join(", ")}` };
  }

  if (process.platform === "darwin") {
    let keychain = `${environment.HOME ?? ""}/Library/Keychains/login.keychain-db`;
    try {
      await runner("security", ["show-keychain-info", keychain], { timeout: 5_000 });
    } catch {
      return {
        ok: false,
        detail: "login Keychain is unreadable; run `security unlock-keychain ~/Library/Keychains/login.keychain-db`",
      };
    }
  }

  let authOutput: string;
  try {
    ({ stdout: authOutput } = await runner("claude", ["auth", "status"], { timeout: 10_000 }));
  } catch {
    return { ok: false, detail: "Claude CLI auth check failed; run `claude auth login`" };
  }
  let auth = parseClaudeAuthStatus(authOutput);
  if (!auth.ok) return auth;

  try {
    let { stdout } = await runner("claude", [
      "-p",
      "Reply exactly: CLAUDE_SUBSCRIPTION_OK",
      "--output-format",
      "text",
      "--max-turns",
      "1",
      "--tools",
      "",
    ], { timeout: 90_000 });
    if (stdout.trim() !== "CLAUDE_SUBSCRIPTION_OK") {
      return { ok: false, detail: "Claude subscription smoke returned an unexpected response" };
    }
  } catch (error) {
    let detail = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: `Claude subscription smoke failed: ${detail}` };
  }

  return { ok: true, detail: `${auth.detail}; live smoke passed` };
}
