import { createServer, type IncomingMessage } from "node:http";

const HOST = "127.0.0.1";
const PORT = 8794;
const UPSTREAM = "http://127.0.0.1:8787";
const MAX_REQUEST_BYTES = 64 * 1024;

const server = createServer(async (request, response) => {
  try {
    let url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
    if (request.method !== "POST" || (url.pathname !== "/mcp" && url.pathname !== "/mcp/")) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    let body = await readRequest(request);
    let upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, {
      method: "POST",
      headers: {
        "accept": request.headers.accept ?? "application/json, text/event-stream",
        "authorization": request.headers.authorization ?? "",
        "content-type": request.headers["content-type"] ?? "application/json",
        "mcp-protocol-version": firstHeader(request.headers["mcp-protocol-version"]) ?? "2025-06-18",
      },
      body,
    });
    response.writeHead(upstream.status, Object.fromEntries(upstream.headers));
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    let status = error instanceof RequestTooLargeError ? 413 : 502;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Proxy failure" }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ChatGPT MCP tunnel boundary: http://${HOST}:${PORT}/mcp`);
});

class RequestTooLargeError extends Error {}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function readRequest(request: IncomingMessage): Promise<Uint8Array> {
  let chunks: Buffer[] = [];
  let length = 0;
  for await (let chunk of request) {
    let buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_REQUEST_BYTES) throw new RequestTooLargeError("Request is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
