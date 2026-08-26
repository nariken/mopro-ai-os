import type {
  Api, AssistantMessage, AssistantMessageEventStream, Context, Model, ToolCall,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { AiModelConfig } from "@gadgets/workshop-shared/api";

type BridgeResponse = {
  content: string;
  toolCalls: Array<{ name: string; argumentsJson: string }>;
};

function parseToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Codex occasionally appends a short explanation after the object despite the response schema.
    // Recover the first complete JSON object below; quoted braces and escapes are handled.
  }

  const start = value.indexOf("{");
  if (start < 0) throw new Error("Codex tool arguments did not contain a JSON object");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index++) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth++;
    else if (character === "}" && --depth === 0) {
      const parsed = JSON.parse(value.slice(start, index + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      break;
    }
  }
  throw new Error("Codex tool arguments were not a complete JSON object");
}

const ZERO_USAGE = {
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/** Build a local Codex-subscription model whose calls are delegated to the companion bridge. */
export function createCodexSubscriptionHandle(config: AiModelConfig): {
  model: Model<Api>;
  stream: (model: Model<Api>, context: Context) => AssistantMessageEventStream;
} {
  const model: Model<Api> = {
    id: config.model,
    name: config.model,
    api: "codex-subscription",
    provider: "openai-codex",
    baseUrl: config.apiUrl || "http://127.0.0.1:8788",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1_050_000,
    maxTokens: 128_000,
  };

  return {
    model,
    stream: (_model, context) => streamCodex(model, context),
  };
}

function streamCodex(model: Model<Api>, context: Context): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const output: AssistantMessage = {
    role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id,
    usage: ZERO_USAGE, stopReason: "pending", timestamp: Date.now(),
  };
  stream.push({ type: "start", partial: output });

  void (async () => {
    try {
      const response = await fetch(`${model.baseUrl.replace(/\/$/, "")}/v1/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: model.id.replace(/^codex:/, ""), context }),
      });
      if (!response.ok) throw new Error(`Codex bridge returned ${response.status}: ${await response.text()}`);
      const result = await response.json() as BridgeResponse;

      if (result.content) {
        const index = output.content.length;
        const block = { type: "text" as const, text: result.content };
        output.content.push(block);
        stream.push({ type: "text_start", contentIndex: index, partial: output });
        stream.push({ type: "text_delta", contentIndex: index, delta: result.content, partial: output });
        stream.push({ type: "text_end", contentIndex: index, content: result.content, partial: output });
      }
      for (const call of result.toolCalls) {
        const index = output.content.length;
        const toolCall: ToolCall = {
          type: "toolCall",
          id: `codex_${crypto.randomUUID()}`,
          name: call.name,
          arguments: parseToolArguments(call.argumentsJson),
        };
        output.content.push(toolCall);
        stream.push({ type: "toolcall_start", contentIndex: index, partial: output });
        stream.push({ type: "toolcall_delta", contentIndex: index, delta: call.argumentsJson, partial: output });
        stream.push({ type: "toolcall_end", contentIndex: index, toolCall, partial: output });
      }

      output.stopReason = result.toolCalls.length ? "toolUse" : "stop";
      stream.push({ type: "done", reason: output.stopReason, message: output });
    } catch (error) {
      output.stopReason = "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: "error", error: output });
    } finally {
      stream.end();
    }
  })();
  return stream;
}
