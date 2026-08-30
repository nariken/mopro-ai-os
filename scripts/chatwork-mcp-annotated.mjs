#!/usr/bin/env node

import { spawn } from "node:child_process";
import readline from "node:readline";

const upstreamScript =
  process.env.CHATWORK_MCP_SERVER ||
  new URL("../node_modules/@chatwork/mcp-server/dist/index.js", import.meta.url).pathname;

// These tools only issue GET requests to Chatwork. Mutating tools intentionally
// retain the upstream annotations so CF OS continues to require approval.
const readOnlyTools = new Set([
  "get_me",
  "get_my_status",
  "list_my_tasks",
  "list_contacts",
  "list_rooms",
  "get_room",
  "list_room_members",
  "list_room_messages",
  "get_room_message",
  "list_room_tasks",
  "get_room_task",
  "list_room_files",
  "get_room_file",
  "get_room_link",
  "list_incoming_requests",
]);

const child = spawn(process.execPath, [upstreamScript], {
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});

process.stdin.pipe(child.stdin);

const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
lines.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    const tools = message?.result?.tools;
    if (Array.isArray(tools)) {
      message.result.tools = tools.map((tool) =>
        readOnlyTools.has(tool.name)
          ? {
              ...tool,
              annotations: {
                ...tool.annotations,
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: true,
              },
            }
          : tool,
      );
    }
    process.stdout.write(`${JSON.stringify(message)}\n`);
  } catch {
    process.stdout.write(`${line}\n`);
  }
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
