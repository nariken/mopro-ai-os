import { afterEach, describe, expect, it, vi } from "vitest";
import { GhostApi } from "../src/ghost-api";

const credentials = {
  baseUrl: "https://example.com",
  adminApiKey: `${"0".repeat(24)}:${"0".repeat(32)}`,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GhostApi.requireCurrentDraft", () => {
  it("returns the current draft when its revision matches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      posts: [{
        id: "post-1",
        title: "Draft",
        slug: "draft",
        status: "draft",
        updated_at: "2026-08-29T00:00:00.000Z",
        tags: [],
      }],
    })));

    const draft = await new GhostApi(credentials)
      .requireCurrentDraft("post-1", "2026-08-29T00:00:00.000Z");

    expect(draft.id).toBe("post-1");
  });

  it("tells the caller to refetch and merge when the revision is stale", async () => {
    const fetchSpy = vi.fn(async () => Response.json({
      posts: [{
        id: "post-1",
        title: "Draft",
        slug: "draft",
        status: "draft",
        updated_at: "2026-08-29T00:01:00.000Z",
        tags: [],
      }],
    }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(new GhostApi(credentials)
      .requireCurrentDraft("post-1", "2026-08-29T00:00:00.000Z"))
      .rejects.toThrow("Fetch the latest draft, merge the intended changes, and propose a new update.");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[1]?.method).toBeUndefined();
  });
});
