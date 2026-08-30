# Chatwork MCP local connection

The official Chatwork MCP server uses the stdio transport. The local MOPRO AI OS MCP Gatekeeper
expects a Streamable HTTP endpoint, so `pnpm chatwork-mcp` runs the official server behind a local
stdio-to-HTTP proxy. A thin local wrapper annotates only the official server's GET-based tools as
read-only; it does not change tool inputs, outputs, or API calls.

## Local configuration

Add these values to the gitignored repository-root `.dev.vars` file:

```dotenv
MCP_ALLOW_INSECURE=true
CHATWORK_API_TOKEN=your-issued-chatwork-api-token
```

Start the bridge in a separate terminal:

```sh
pnpm chatwork-mcp
```

The endpoint is `http://127.0.0.1:8790/mcp`. It listens only on loopback and is not exposed to the
LAN. Start MOPRO AI OS with `pnpm dev-server -- --serve-frontend-assets`, then add an **MCP Server**
connection using that endpoint.

The API token stays in `.dev.vars`; do not paste it into the MCP endpoint form or commit it.

## Safety

Prefer a named-tool grant over **All tools**. Profile, status, task, room, message, file, and incoming
request retrieval tools are annotated as read-only and can run as observations. Message posting,
read/unread changes, room changes, task changes, invitation changes, approvals, rejections, and
deletions remain actions and require approval. Keep those action tools out of the grant unless the
Gadget needs them.
