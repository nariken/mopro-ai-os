# ChatGPT → MOPRO AI OS MCP

Private, single-user MCP bridge for sending ChatGPT tasks into a persistent MOPRO AI OS workspace.
It calls the Workshop backend through the existing `ExternalMessageGateway` service binding; the
backend remains responsible for account access, workspace/chat continuity, model selection, agent
execution, and approval queues.

## Configuration

Set the account email as a non-secret Worker variable and create the access token as a secret:

```sh
pnpm --filter @gadgets/chatgpt-mcp exec wrangler secret put MCP_ACCESS_TOKEN
pnpm --filter @gadgets/chatgpt-mcp exec wrangler deploy --var MOPRO_CALLER_EMAIL:you@example.com
```

The email must already have a MOPRO AI OS account with an AI model configured. For a private MVP,
add the deployed endpoint to ChatGPT as:

```text
https://mopro-chatgpt-mcp.<your-subdomain>.workers.dev/mcp?token=<MCP_ACCESS_TOKEN>
```

The query token is an intentionally narrow bootstrap mechanism for one operator. Before a public or
multi-user release, replace it with OAuth 2.1 and bind the authenticated MOPRO identity instead of
the fixed `MOPRO_CALLER_EMAIL`.

## Tool

`ask_mopro` selects a stable workspace and conversation using caller-provided keys, submits the
prompt, waits for the MOPRO agent's completed response, and returns both the response text and the
MOPRO workspace path. Reusing both keys continues the same conversation.
