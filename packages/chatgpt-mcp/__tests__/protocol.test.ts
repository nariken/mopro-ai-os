import { describe, expect, it } from "vitest";
import { parseAskMoproArguments } from "../src/protocol";

describe("parseAskMoproArguments", () => {
  it("normalizes a valid request", () => {
    expect(parseAskMoproArguments({
      prompt: "  今日の運用状況をまとめて  ",
      workspace_key: "personal-operations",
      conversation_key: "daily:2026-08-29",
      workspace_title: "  Personal Operations  ",
    })).toEqual({
      prompt: "今日の運用状況をまとめて",
      workspaceKey: "personal-operations",
      conversationKey: "daily:2026-08-29",
      workspaceTitle: "Personal Operations",
    });
  });

  it("rejects unsafe keys", () => {
    expect(() => parseAskMoproArguments({
      prompt: "test",
      workspace_key: "../../other",
      conversation_key: "daily",
      workspace_title: "Test",
    })).toThrow("workspace_key");
  });
});
