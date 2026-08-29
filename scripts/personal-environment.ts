#!/usr/bin/env node

import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import { pnpmCommand } from "./pnpm-command.ts";
import { PERSONAL_SERVICES, personalService, type PersonalService } from "./personal-ports.ts";

const command = process.argv[2] ?? "doctor";
const withLocalMcp = process.argv.includes("--with-local-mcp");
const started: ChildProcess[] = [];

function pnpm(...args: string[]): string[] {
  let [executable, commandArgs] = pnpmCommand(args);
  return [executable, ...commandArgs];
}

const START_COMMANDS: Partial<Record<PersonalService["id"], string[]>> = {
  "mopro-frontend": pnpm("dev-client"),
  "mopro-router": pnpm("dev-server"),
  "codex-subscription": pnpm("codex-bridge"),
  "chatwork-mcp": pnpm("chatwork-mcp"),
  "mattermost-mcp": pnpm("mattermost-mcp"),
  "multica-mcp": pnpm("multica-mcp"),
  "local-video-mcp": pnpm("local-video-mcp"),
  "chatgpt-mcp-proxy": pnpm("chatgpt-mcp-proxy"),
};

type Check = { ok: boolean; state: "free" | "healthy" | "conflict"; detail: string };

async function portOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    let socket = connect({ host: "127.0.0.1", port });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.setTimeout(1_000, () => { socket.destroy(); resolve(false); });
  });
}

async function check(service: PersonalService): Promise<Check> {
  if (!await portOpen(service.port)) return {
    ok: service.tier === "optional", state: "free", detail: "not running",
  };
  try {
    let response = await fetch(service.url, { signal: AbortSignal.timeout(3_000) });
    let body = service.id === "mopro-frontend" || service.id === "mopro-router" ||
        service.id === "codex-subscription" ? await response.text() : "";
    if (service.id === "mopro-frontend") {
      let healthy = response.ok && body.includes("MOPRO AI OS");
      return healthy ? { ok: true, state: "healthy", detail: "MOPRO UI" } :
        { ok: false, state: "conflict", detail: "port is owned by a different frontend" };
    }
    if (service.id === "mopro-router") {
      let healthy = response.status === 400 && body.includes("POST or WebSocket");
      return healthy ? { ok: true, state: "healthy", detail: "Workshop Router" } :
        { ok: false, state: "conflict", detail: `unexpected HTTP ${response.status}` };
    }
    if (service.id === "codex-subscription") {
      let parsed = JSON.parse(body) as { ok?: boolean; mode?: string };
      let healthy = response.ok && parsed.ok === true && parsed.mode === "chatgpt-subscription";
      return healthy ? { ok: true, state: "healthy", detail: "chatgpt-subscription" } :
        { ok: false, state: "conflict", detail: "not the subscription bridge" };
    }
    return { ok: true, state: "healthy", detail: `listening (HTTP ${response.status})` };
  } catch (error) {
    if (service.tier !== "core") return { ok: true, state: "healthy", detail: "TCP listening" };
    return { ok: false, state: "conflict", detail: error instanceof Error ? error.message : String(error) };
  }
}

async function doctor(): Promise<boolean> {
  let allOk = true;
  for (let service of PERSONAL_SERVICES) {
    let result = await check(service);
    let required = service.tier === "core" || service.id === "multica-backend" || service.id === "multica-frontend";
    if (required && !result.ok) allOk = false;
    console.log(`${result.ok ? "OK" : "FAIL"}\t${service.port}\t${service.id}\t${result.detail}`);
  }
  return allOk;
}

function startService(service: PersonalService): void {
  let invocation = START_COMMANDS[service.id];
  if (!invocation) throw new Error(`No start command for ${service.id}`);
  let child = spawn(invocation[0]!, invocation.slice(1), { cwd: process.cwd(), stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (code !== null && code !== 0) console.error(`${service.id} exited with code ${code}.`);
    if (signal) console.error(`${service.id} exited from signal ${signal}.`);
  });
  started.push(child);
}

async function waitHealthy(service: PersonalService): Promise<void> {
  let deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    let result = await check(service);
    if (result.state === "healthy" && result.ok) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`${service.id} did not become healthy on port ${service.port}.`);
}

async function startEnvironment(): Promise<void> {
  let ids: PersonalService["id"][] = ["codex-subscription", "mopro-router", "mopro-frontend"];
  if (withLocalMcp) ids.push("chatwork-mcp", "mattermost-mcp", "multica-mcp", "local-video-mcp");
  for (let id of ids) {
    let service = personalService(id);
    let result = await check(service);
    if (result.state === "healthy") {
      console.log(`Reusing ${service.id} on ${service.port} (${result.detail}).`);
      continue;
    }
    if (result.state === "conflict") {
      throw new Error(`Port ${service.port} is not ${service.id}: ${result.detail}`);
    }
    console.log(`Starting ${service.id} on ${service.port}.`);
    startService(service);
    await waitHealthy(service);
  }
  console.log("MOPRO Personal is ready at http://localhost:3000/.");
  if (started.length) await new Promise<void>(() => {});
}

function stopChildren(): void {
  for (let child of started) child.kill("SIGTERM");
}
process.on("SIGINT", () => { stopChildren(); process.exit(130); });
process.on("SIGTERM", () => { stopChildren(); process.exit(143); });

if (command === "doctor") {
  process.exitCode = await doctor() ? 0 : 1;
} else if (command === "start") {
  await startEnvironment().catch(error => {
    stopChildren();
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
} else {
  console.error("Usage: pnpm mopro:doctor | pnpm mopro:start [-- --with-local-mcp]");
  process.exitCode = 2;
}
