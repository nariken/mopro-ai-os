#!/usr/bin/env node

import { spawn } from "node:child_process";
import readline from "node:readline";

const upstreamScript =
  process.env.MULTICA_MCP_SERVER ||
  "/Users/kennarita/multica-custom/scripts/multica_mcp_server.mjs";

const readOnlyTools = new Set([
  "multica_issue_list",
  "multica_issue_get",
  "multica_issue_search",
  "issue_comment_list",
  "issue_run_list",
  "issue_run_messages",
  "multica_agent_list",
  "multica_squad_list",
  "multica_runtime_list",
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
                openWorldHint: false,
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
