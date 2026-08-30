#!/usr/bin/env node

import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const HOST = process.env.CODEX_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.CODEX_BRIDGE_PORT || "8788");
const HEALTH_URL = `http://${HOST}:${PORT}/health`;
const CHECK_INTERVAL_MS = 5_000;

let bridge: ChildProcess | null = null;
let checking = false;
let stopping = false;

async function isHealthy(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) return false;
    const body = await response.json() as { ok?: unknown, mode?: unknown };
    return body.ok === true && body.mode === "chatgpt-subscription";
  } catch {
    return false;
  }
}

function startBridge(): void {
  if (stopping || bridge) return;
  console.warn("Codex subscription bridge is unavailable; starting it now.");
  const child = spawn(process.execPath, [join(SCRIPTS_DIR, "codex-subscription-bridge.ts")], {
    cwd: join(SCRIPTS_DIR, ".."),
    env: process.env,
    stdio: "inherit",
  });
  bridge = child;
  child.on("error", error => {
    console.error(`Codex subscription bridge failed to start: ${error.message}`);
  });
  child.on("exit", (code, signal) => {
    if (bridge === child) bridge = null;
    if (!stopping) {
      console.error(`Codex subscription bridge exited (code=${code}, signal=${signal}); ` +
          "the supervisor will restart it.");
    }
  });
}

async function checkBridge(): Promise<void> {
  if (stopping || checking) return;
  checking = true;
  try {
    if (await isHealthy()) return;
    if (bridge && bridge.exitCode === null && bridge.signalCode === null) {
      console.error("Codex subscription bridge health check failed; restarting it.");
      bridge.kill("SIGTERM");
      return;
    }
    bridge = null;
    startBridge();
  } finally {
    checking = false;
  }
}

function shutdown(signal: NodeJS.Signals): void {
  if (stopping) return;
  stopping = true;
  if (bridge?.exitCode === null) bridge.kill(signal);
  process.exit(signal === "SIGINT" ? 130 : 143);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log(`Monitoring Codex subscription bridge at ${HEALTH_URL}.`);
await checkBridge();
setInterval(checkBridge, CHECK_INTERVAL_MS);
