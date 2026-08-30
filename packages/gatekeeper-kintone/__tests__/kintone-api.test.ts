import { afterEach, describe, expect, it, vi } from "vitest";
import { KintoneApi, KintoneApiError } from "../src/kintone-api";

const credentials = {
  origin: "https://example.cybozu.com",
  appId: "42",
  apiToken: "secret-token",
};

afterEach(() => vi.unstubAllGlobals());

describe("KintoneApi", () => {
  it("sends the app-scoped token and normalizes records", async () => {
    const fetchMock = vi.fn(async () => Response.json({
      record: {
        $id: { type: "__ID__", value: "7" },
        $revision: { type: "__REVISION__", value: "3" },
        title: { type: "SINGLE_LINE_TEXT", value: "商談" },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new KintoneApi(credentials).getRecord("7")).resolves.toEqual({
      id: "7",
      revision: "3",
      fields: { title: "商談" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.cybozu.com/k/v1/record.json?app=42&id=7",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Cybozu-API-Token": "secret-token" }),
      }),
    );
  });

  it("rejects caller-supplied pagination before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(new KintoneApi(credentials).queryRecords({
      query: "status = \"open\" limit 10",
      limit: 100,
      offset: 0,
    })).rejects.toThrow("must not include limit or offset");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves kintone error status and code", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { code: "GAIA_NO01", message: "No permission" },
      { status: 403 },
    )));

    const error = await new KintoneApi(credentials).getApp().catch(value => value);
    expect(error).toBeInstanceOf(KintoneApiError);
    expect(error).toMatchObject({ status: 403, code: "GAIA_NO01", isAccessError: true });
  });
});
