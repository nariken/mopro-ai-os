import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkClaudeSubscription,
  meteredClaudeEnvironment,
  parseClaudeAuthStatus,
  type ClaudeHealthRunner,
} from "./claude-subscription-health.ts";

describe("Claude subscription health", () => {
  it("rejects environment variables that can select metered or overriding routes", () => {
    assert.deepEqual(meteredClaudeEnvironment({ ANTHROPIC_API_KEY: "hidden" }), ["ANTHROPIC_API_KEY"]);
  });

  it("accepts an authenticated Claude subscription", () => {
    assert.deepEqual(parseClaudeAuthStatus(JSON.stringify({
      loggedIn: true,
      authMethod: "claude.ai",
      subscriptionType: "pro",
    })), { ok: true, detail: "claude.ai pro" });
  });

  it("rejects a stale or non-subscription login before the live smoke", () => {
    assert.equal(parseClaudeAuthStatus(JSON.stringify({ loggedIn: false })).ok, false);
    assert.equal(parseClaudeAuthStatus(JSON.stringify({
      loggedIn: true,
      authMethod: "apiKey",
      subscriptionType: "pro",
    })).ok, false);
  });

  it("runs Keychain, auth, and live smoke in order", async () => {
    let calls: string[] = [];
    let runner: ClaudeHealthRunner = async (command, args) => {
      calls.push(`${command} ${args.join(" ")}`);
      if (command === "claude" && args[0] === "auth") return {
        stdout: JSON.stringify({ loggedIn: true, authMethod: "claude.ai", subscriptionType: "pro" }),
        stderr: "",
      };
      if (command === "claude") return { stdout: "CLAUDE_SUBSCRIPTION_OK\n", stderr: "" };
      return { stdout: "", stderr: "" };
    };
    let result = await checkClaudeSubscription({ HOME: "/tmp/test-home" }, runner);
    assert.equal(result.ok, true);
    assert.deepEqual(calls.map(call => call.split(" ")[0]), process.platform === "darwin" ?
      ["security", "claude", "claude"] : ["claude", "claude"]);
  });

  it("does not run any command when a metered override is present", async () => {
    let called = false;
    let result = await checkClaudeSubscription({ ANTHROPIC_API_KEY: "hidden" }, async () => {
      called = true;
      return { stdout: "", stderr: "" };
    });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });
});
