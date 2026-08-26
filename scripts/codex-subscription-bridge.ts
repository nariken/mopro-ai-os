import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

type BridgeRequest = {
  model: string;
  context: {
    systemPrompt?: string;
    messages: Array<Record<string, unknown>>;
    tools?: Array<{ name: string; description: string; parameters: unknown }>;
  };
};

const HOST = process.env.CODEX_BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.CODEX_BRIDGE_PORT || "8788");
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const responseSchema = {
  type: "object",
  properties: {
    content: { type: "string" },
    toolCalls: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, argumentsJson: { type: "string" } },
        required: ["name", "argumentsJson"],
        additionalProperties: false,
      },
    },
  },
  required: ["content", "toolCalls"],
  additionalProperties: false,
} as const;

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<BridgeRequest> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as BridgeRequest;
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return JSON.stringify(value);
  return value.map((part) => {
    if (!part || typeof part !== "object") return String(part);
    const item = part as Record<string, unknown>;
    if (item.type === "text") return String(item.text || "");
    if (item.type === "image") return "[image omitted by local Codex bridge]";
    if (item.type === "thinking") return `[prior reasoning omitted]`;
    if (item.type === "toolCall") return `[tool call ${String(item.name)} ${JSON.stringify(item.arguments)}]`;
    return JSON.stringify(item);
  }).join("\n");
}

function buildPrompt(input: BridgeRequest): string {
  const tools = input.context.tools || [];
  const transcript = input.context.messages.map((message) => {
    const role = String(message.role || "unknown");
    if (role === "toolResult") {
      return `TOOL RESULT (${String(message.toolName)}; error=${String(message.isError)}):\n${textContent(message.content)}`;
    }
    return `${role.toUpperCase()}:\n${textContent(message.content)}`;
  }).join("\n\n");
  const toolText = tools.length ? JSON.stringify(tools, null, 2) : "[]";

  return `You are acting as one inference step inside Cloudflare OS. Do not use your own shell,\n` +
    `filesystem, network, or built-in tools. The host application owns all tool execution.\n` +
    `Return either assistant text, host tool calls, or both. Do not claim a host tool ran until a\n` +
    `later TOOL RESULT says it did. argumentsJson must contain exactly one valid JSON object and\n` +
    `nothing before or after it (no Markdown or explanation). Only call\n` +
    `tools listed below and preserve their exact names. If no tool is needed, return an empty array.\n\n` +
    `SYSTEM PROMPT:\n${input.context.systemPrompt || ""}\n\n` +
    `AVAILABLE HOST TOOLS:\n${toolText}\n\nCONVERSATION:\n${transcript}`;
}

async function runCodex(input: BridgeRequest): Promise<unknown> {
  if (!input.model || !input.context || !Array.isArray(input.context.messages)) {
    throw new Error("Invalid bridge request");
  }
  const work = await mkdtemp(join(tmpdir(), "cloudflare-os-codex-"));
  const schemaPath = join(work, "response-schema.json");
  const outputPath = join(work, "response.json");
  await writeFile(schemaPath, JSON.stringify(responseSchema));

  try {
    const args = [
      "-a", "never", "-s", "read-only", "exec", "--ephemeral", "--ignore-user-config",
      "--ignore-rules", "--skip-git-repo-check", "--color", "never", "-m", input.model,
      "--output-schema", schemaPath, "--output-last-message", outputPath, "-C", work, "-",
    ];
    const child = spawn("codex", args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-16_000); });
    child.stdin.end(buildPrompt(input));
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) throw new Error(`Codex exited with ${exitCode}: ${stderr.trim()}`);
    return JSON.parse(await readFile(outputPath, "utf8")) as unknown;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true, mode: "chatgpt-subscription" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/respond") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }
  try {
    sendJson(response, 200, await runCodex(await readJson(request)));
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Codex subscription bridge listening on http://${HOST}:${PORT}`);
});
