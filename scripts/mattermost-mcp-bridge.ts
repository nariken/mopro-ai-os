import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";

const HOST = "127.0.0.1";
const PORT = 8791;
const CALLBACK_URL = `http://${HOST}:${PORT}/oauth/callback`;
const TOKEN_PATH = resolve(".wrangler/mattermost-oauth.json");

const mattermostUrl = requiredEnv("MATTERMOST_URL").replace(/\/$/, "");
const clientId = requiredEnv("MATTERMOST_CLIENT_ID");
const clientSecret = requiredEnv("MATTERMOST_CLIENT_SECRET");
const pendingStates = new Set<string>();

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type TokenRecord = {
  access_token: string;
  token_type?: string;
  scope?: string;
  createdAt: string;
};

const tools = [
  tool("get_me", "Return the authenticated Mattermost user.", {}, true),
  tool("list_teams", "List teams available to the authenticated user.", {}, true),
  tool("list_channels", "List channels in a Mattermost team.", {
    team_id: stringField("Mattermost team ID"),
    page: integerField("Zero-based page", 0),
    per_page: integerField("Results per page (1-200)", 60),
  }, true, ["team_id"]),
  tool("read_channel", "Read recent posts from a Mattermost channel.", {
    channel_id: stringField("Mattermost channel ID"),
    page: integerField("Zero-based page", 0),
    per_page: integerField("Posts per page (1-200)", 60),
  }, true, ["channel_id"]),
  tool("search_posts", "Search Mattermost posts in a team.", {
    team_id: stringField("Mattermost team ID"),
    terms: stringField("Mattermost search terms"),
    is_or_search: { type: "boolean", description: "Match any term instead of all terms", default: false },
  }, true, ["team_id", "terms"]),
  tool("get_post", "Read one Mattermost post and its thread.", {
    post_id: stringField("Mattermost post ID"),
  }, true, ["post_id"]),
  tool("create_post", "Create a Mattermost channel post or thread reply.", {
    channel_id: stringField("Mattermost channel ID"),
    message: stringField("Message body"),
    root_id: stringField("Optional root post ID for a reply"),
  }, false, ["channel_id", "message"]),
] as const;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
    if (request.method === "GET" && url.pathname === "/") return home(response);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true, authenticated: await hasToken() });
    }
    if (request.method === "GET" && url.pathname === "/oauth/start") return startOAuth(response);
    if (request.method === "GET" && url.pathname === "/oauth/callback") {
      return finishOAuth(url, response);
    }
    if (request.method === "POST" && url.pathname === "/mcp") return handleMcp(request, response);
    if (request.method === "GET" && url.pathname === "/mcp") {
      response.writeHead(405, { Allow: "POST" });
      return response.end("Use POST for this stateless MCP endpoint.");
    }
    response.writeHead(404);
    response.end("Not found");
  } catch (error) {
    console.error("Mattermost bridge request failed", error);
    json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mattermost MCP bridge: http://${HOST}:${PORT}/mcp`);
  console.log(`Authorize Mattermost: http://${HOST}:${PORT}/oauth/start`);
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  readOnly: boolean,
  required: string[] = [],
) {
  return {
    name,
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: readOnly },
  };
}

function stringField(description: string) {
  return { type: "string", description };
}

function integerField(description: string, defaultValue: number) {
  return { type: "integer", description, default: defaultValue, minimum: 0, maximum: 200 };
}

function home(response: ServerResponse) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><meta charset="utf-8"><title>Mattermost MCP Bridge</title>
    <h1>Mattermost MCP Bridge</h1><p><a href="/oauth/start">Connect Mattermost</a></p>
    <p>MCP endpoint: <code>http://${HOST}:${PORT}/mcp</code></p>`);
}

function startOAuth(response: ServerResponse) {
  const state = randomBytes(32).toString("hex");
  pendingStates.add(state);
  const authorize = new URL("/oauth/authorize", mattermostUrl);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: CALLBACK_URL,
    state,
  }).toString();
  response.writeHead(302, { Location: authorize.toString() });
  response.end();
}

async function finishOAuth(url: URL, response: ServerResponse) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !pendingStates.delete(state)) {
    return html(response, 400, "OAuth failed", "Invalid or expired OAuth callback state.");
  }
  const tokenResponse = await fetch(`${mattermostUrl}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: CALLBACK_URL,
    }),
  });
  if (!tokenResponse.ok) {
    return html(response, 502, "OAuth failed", `Token exchange returned HTTP ${tokenResponse.status}.`);
  }
  const token = await tokenResponse.json() as Partial<TokenRecord>;
  if (!token.access_token) return html(response, 502, "OAuth failed", "No access token was returned.");
  await mkdir(dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify({ ...token, createdAt: new Date().toISOString() }), {
    encoding: "utf8",
    mode: 0o600,
  });
  return html(response, 200, "Mattermost connected", "You can close this tab and connect the MCP endpoint in CF OS.");
}

async function handleMcp(request: IncomingMessage, response: ServerResponse) {
  const rpc = JSON.parse(await readBody(request)) as JsonRpcRequest;
  if (!rpc.id) {
    response.writeHead(202);
    return response.end();
  }
  if (rpc.method === "initialize") {
    return rpcResult(response, rpc.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mopro-mattermost-local", version: "0.1.0" },
    });
  }
  if (rpc.method === "ping") return rpcResult(response, rpc.id, {});
  if (rpc.method === "tools/list") return rpcResult(response, rpc.id, { tools });
  if (rpc.method === "tools/call") {
    try {
      const params = rpc.params ?? {};
      const result = await callTool(String(params.name ?? ""), objectValue(params.arguments));
      return rpcResult(response, rpc.id, { content: [{ type: "text", text: JSON.stringify(result) }] });
    } catch (error) {
      return rpcResult(response, rpc.id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      });
    }
  }
  return rpcError(response, rpc.id, -32601, `Method not found: ${rpc.method}`);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_me": return mattermostApi("/api/v4/users/me");
    case "list_teams": return mattermostApi("/api/v4/users/me/teams");
    case "list_channels": {
      const teamId = requireString(args, "team_id");
      return mattermostApi(`/api/v4/users/me/teams/${encodeURIComponent(teamId)}/channels${pageQuery(args)}`);
    }
    case "read_channel": {
      const channelId = requireString(args, "channel_id");
      return mattermostApi(`/api/v4/channels/${encodeURIComponent(channelId)}/posts${pageQuery(args)}`);
    }
    case "search_posts": {
      const teamId = requireString(args, "team_id");
      return mattermostApi(`/api/v4/teams/${encodeURIComponent(teamId)}/posts/search`, {
        method: "POST",
        body: JSON.stringify({ terms: requireString(args, "terms"), is_or_search: args.is_or_search === true }),
      });
    }
    case "get_post": {
      const postId = requireString(args, "post_id");
      return mattermostApi(`/api/v4/posts/${encodeURIComponent(postId)}/thread`);
    }
    case "create_post": return mattermostApi("/api/v4/posts", {
      method: "POST",
      body: JSON.stringify({
        channel_id: requireString(args, "channel_id"),
        message: requireString(args, "message"),
        ...(typeof args.root_id === "string" && args.root_id ? { root_id: args.root_id } : {}),
      }),
    });
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function mattermostApi(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await readToken();
  const response = await fetch(`${mattermostUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`Mattermost API returned HTTP ${response.status}`);
  return response.json();
}

async function readToken(): Promise<TokenRecord> {
  try {
    const parsed = JSON.parse(await readFile(TOKEN_PATH, "utf8")) as Partial<TokenRecord>;
    if (!parsed.access_token) throw new Error("missing access token");
    return parsed as TokenRecord;
  } catch {
    throw new Error(`Mattermost is not connected. Open http://${HOST}:${PORT}/oauth/start first.`);
  }
}

async function hasToken() {
  try { await readToken(); return true; } catch { return false; }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value) throw new Error(`${key} is required`);
  return value;
}

function pageQuery(args: Record<string, unknown>): string {
  const page = typeof args.page === "number" ? Math.max(0, Math.floor(args.page)) : 0;
  const perPage = typeof args.per_page === "number" ? Math.min(200, Math.max(1, Math.floor(args.per_page))) : 60;
  return `?page=${page}&per_page=${perPage}`;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function rpcResult(response: ServerResponse, id: JsonRpcRequest["id"], result: unknown) {
  return json(response, 200, { jsonrpc: "2.0", id, result });
}

function rpcError(response: ServerResponse, id: JsonRpcRequest["id"], code: number, message: string) {
  return json(response, 200, { jsonrpc: "2.0", id, error: { code, message } });
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function html(response: ServerResponse, status: number, title: string, message: string) {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><meta charset="utf-8"><title>${title}</title><h1>${title}</h1><p>${message}</p>`);
}
