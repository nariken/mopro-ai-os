import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchConsoleApi } from "../src/search-console-api";

afterEach(() => vi.unstubAllGlobals());

function apiWith(body: unknown): SearchConsoleApi {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), {
    status: 200,
    headers: {"Content-Type": "application/json"},
  })));
  return new SearchConsoleApi(async () => "token");
}

describe("SearchConsoleApi", () => {
  it("normalizes sitemap data without the deprecated indexed count", async () => {
    let api = apiWith({sitemap: [{
      path: "https://example.com/sitemap.xml",
      lastDownloaded: "2026-08-27T00:00:00Z",
      isPending: false,
      isSitemapsIndex: false,
      type: "sitemap",
      warnings: "1",
      errors: "0",
      contents: [{type: "web", submitted: "28", indexed: "27"}],
    }]});

    expect(await api.listSitemaps("sc-domain:example.com")).toEqual([{
      path: "https://example.com/sitemap.xml",
      lastDownloaded: "2026-08-27T00:00:00Z",
      isPending: false,
      isSitemapsIndex: false,
      type: "sitemap",
      warnings: 1,
      errors: 0,
      contents: [{type: "web", submitted: 28}],
    }]);
  });

  it("normalizes index and structured-data inspection results", async () => {
    let api = apiWith({inspectionResult: {
      inspectionResultLink: "https://search.google.com/test",
      indexStatusResult: {
        verdict: "PASS",
        coverageState: "Submitted and indexed",
        lastCrawlTime: "2026-08-26T01:02:03Z",
        sitemap: ["https://example.com/sitemap.xml"],
      },
      richResultsResult: {
        verdict: "PASS",
        detectedItems: [{
          richResultType: "Article",
          items: [{name: "Example", issues: [{severity: "WARNING", issueMessage: "Optional"}]}],
        }],
      },
    }});

    let result = await api.inspectUrl(
      "sc-domain:example.com", "https://example.com/article/", "ja-JP",
    );
    expect(result.verdict).toBe("PASS");
    expect(result.lastCrawlTime).toBe("2026-08-26T01:02:03Z");
    expect(result.richResults?.detectedItems[0].items[0].issues[0].message).toBe("Optional");
  });
});
