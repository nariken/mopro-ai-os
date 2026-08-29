/** Maximum accepted JSON-RPC request size. */
export const MAX_REQUEST_BYTES = 64 * 1024;

/** MCP tool exposed to ChatGPT. */
export const MOPRO_TOOL = {
  name: "ask_mopro",
  description: "Send a task to a persistent MOPRO AI OS workspace and return the agent's completed response.",
  inputSchema: {
    type: "object",
    properties: {
      prompt: { type: "string", minLength: 1, description: "Task or question for the MOPRO agent." },
      workspace_key: {
        type: "string",
        minLength: 1,
        description: "Stable key for the MOPRO workspace. Reuse it to keep the same workspace.",
      },
      conversation_key: {
        type: "string",
        minLength: 1,
        description: "Stable key for the conversation. Reuse it to continue the same MOPRO chat.",
      },
      workspace_title: {
        type: "string",
        minLength: 1,
        description: "Title used only when the workspace is first created.",
      },
    },
    required: ["prompt", "workspace_key", "conversation_key", "workspace_title"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
} as const;

/** Parsed JSON-RPC request fields used by the stateless MCP transport. */
export type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: unknown;
};

/** Validated arguments for `ask_mopro`. */
export type AskMoproArguments = {
  prompt: string;
  workspaceKey: string;
  conversationKey: string;
  workspaceTitle: string;
};

/** Parse and validate `ask_mopro` arguments. */
export function parseAskMoproArguments(value: unknown): AskMoproArguments {
  if (!isRecord(value)) throw new Error("Tool arguments must be an object.");
  return {
    prompt: requiredString(value, "prompt", 20_000),
    workspaceKey: requiredKey(value, "workspace_key"),
    conversationKey: requiredKey(value, "conversation_key"),
    workspaceTitle: requiredString(value, "workspace_title", 120),
  };
}

/** Return true when the request is a JSON-RPC notification with no response ID. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined || request.id === null;
}

function requiredKey(value: Record<string, unknown>, field: string): string {
  let result = requiredString(value, field, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result)) {
    throw new Error(`${field} may contain only letters, numbers, dot, underscore, colon, and dash.`);
  }
  return result;
}

function requiredString(value: Record<string, unknown>, field: string, maxLength: number): string {
  let raw = value[field];
  if (typeof raw !== "string" || !raw.trim()) throw new Error(`${field} is required.`);
  let result = raw.trim();
  if (result.length > maxLength) throw new Error(`${field} must be at most ${maxLength} characters.`);
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
