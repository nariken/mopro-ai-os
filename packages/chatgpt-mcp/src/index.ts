import { RpcStub, RpcTarget, WorkerEntrypoint } from "cloudflare:workers";
import { validateRpc } from "capnweb-validate";
import type {
  ChatGatewayRpcTarget,
  ExternalMessageGateway,
  GadgetResponse,
} from "@gadgets/workshop-shared/external-message-gateway";
import {
  isNotification,
  MAX_REQUEST_BYTES,
  MOPRO_TOOL,
  parseAskMoproArguments,
  type JsonRpcRequest,
} from "./protocol";

const RESPONSE_TIMEOUT_MS = 10 * 60 * 1000;

class MoproGatewayEntrypoint extends WorkerEntrypoint implements ExternalMessageGateway {
  submitExternalMessage(
    input: Parameters<ExternalMessageGateway["submitExternalMessage"]>[0],
  ): ReturnType<ExternalMessageGateway["submitExternalMessage"]> {
    void input;
    throw new Error("Type-only service binding class must not be instantiated.");
  }
}

@validateRpc()
class ResponseTarget extends RpcTarget implements ChatGatewayRpcTarget {
  readonly response: Promise<GadgetResponse>;
  #resolve!: (response: GadgetResponse) => void;

  constructor() {
    super();
    this.response = new Promise(resolve => {
      this.#resolve = resolve;
    });
  }

  async onGadgetResponse(response: GadgetResponse): Promise<void> {
    this.#resolve(response);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    let url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "mopro-chatgpt-mcp" });
    }
    if (request.method !== "POST" || url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }
    if (!await authorized(request, url, env.MCP_ACCESS_TOKEN)) {
      return json({ error: "Unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
    }
    if (!env.MOPRO_CALLER_EMAIL?.trim()) {
      return json({ error: "MOPRO_CALLER_EMAIL is not configured." }, 503);
    }

    let contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_REQUEST_BYTES) return json({ error: "Request is too large." }, 413);

    let rpc: JsonRpcRequest;
    try {
      let body = await request.text();
      if (body.length > MAX_REQUEST_BYTES) return json({ error: "Request is too large." }, 413);
      rpc = JSON.parse(body) as JsonRpcRequest;
    } catch {
      return rpcError(null, -32700, "Parse error");
    }
    if (isNotification(rpc)) return new Response(null, { status: 202 });

    if (rpc.method === "initialize") {
      return rpcResult(rpc.id!, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "mopro-ai-os", version: "0.1.0" },
      });
    }
    if (rpc.method === "ping") return rpcResult(rpc.id!, {});
    if (rpc.method === "tools/list") return rpcResult(rpc.id!, { tools: [MOPRO_TOOL] });
    if (rpc.method !== "tools/call") {
      return rpcError(rpc.id!, -32601, `Method not found: ${String(rpc.method)}`);
    }

    try {
      let params = record(rpc.params);
      if (params.name !== MOPRO_TOOL.name) throw new Error(`Unknown tool: ${String(params.name)}`);
      let args = parseAskMoproArguments(params.arguments);
      let target = new ResponseTarget();
      using targetStub = new RpcStub(target);
      let gateway = env.MOPRO_GATEWAY as Service<typeof MoproGatewayEntrypoint>;
      let result = await gateway.submitExternalMessage({
        callerEmail: env.MOPRO_CALLER_EMAIL.trim(),
        gadgetKey: args.workspaceKey,
        chatKey: `${args.workspaceKey}:${args.conversationKey}`,
        messageKey: crypto.randomUUID(),
        gadgetTitle: args.workspaceTitle,
        prompt: args.prompt,
        chatGatewayRpcTarget: targetStub,
      });
      if (!result.accepted) throw new Error(result.message);

      let completed = await withTimeout(target.response);
      return rpcResult(rpc.id!, {
        content: [{ type: "text", text: completed.text }],
        structuredContent: { response: completed.text, workspacePath: result.chatPath },
      });
    } catch (error) {
      return rpcResult(rpc.id!, {
        content: [{ type: "text", text: error instanceof Error ? error.message : "MOPRO request failed." }],
        isError: true,
      });
    }
  },
} satisfies ExportedHandler<Env>;

async function withTimeout(response: Promise<GadgetResponse>): Promise<GadgetResponse> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      response,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("MOPRO did not finish within 10 minutes.")),
          RESPONSE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function authorized(request: Request, url: URL, expected: string | undefined): Promise<boolean> {
  if (!expected) return false;
  let supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ?? "";
  let encoder = new TextEncoder();
  let expectedDigest = await crypto.subtle.digest("SHA-256", encoder.encode(expected));
  let suppliedDigest = await crypto.subtle.digest("SHA-256", encoder.encode(supplied));
  return crypto.subtle.timingSafeEqual(expectedDigest, suppliedDigest);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid JSON-RPC parameters.");
  }
  return value as Record<string, unknown>;
}

function rpcResult(id: string | number, result: unknown): Response {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(value, { status, headers });
}
