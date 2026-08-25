import { describe, expect, it } from "vitest";
import {
  beginStoredOAuthFlow, claimStoredOAuthFlow, prepareOAuthFlow,
  type OAuthFlowMode,
} from "../src/oauth-flow";
import {
  BIGQUERY_RESOURCE, GOOGLE_DOC_RESOURCE, IDENTITY_SCOPES,
} from "../src/resources";

const TEN_MINUTES = 10 * 60 * 1000;

class FakeKv {
  readonly data = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  put<T>(key: string, value: T): void {
    this.data.set(key, structuredClone(value));
  }

  delete(key: string): void {
    this.data.delete(key);
  }
}

describe("stored OAuth flow", () => {
  it("keeps a claimed attempt immutable while a later consent flow starts", () => {
    let kv = new FakeKv();
    prepareOAuthFlow(kv, "init-docs", [GOOGLE_DOC_RESOURCE.urlPattern], "reconnect", 1_000);

    expect(beginStoredOAuthFlow(kv, "init-docs", "oauth-docs", 2_000)).toEqual({
      oauthNonce: "oauth-docs",
      scopes: [
        ...IDENTITY_SCOPES,
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
      ],
    });
    let claimedDocs = claimStoredOAuthFlow(kv, "oauth-docs", 3_000);

    prepareOAuthFlow(kv, "init-bigquery", [BIGQUERY_RESOURCE.urlPattern], "reconnect", 4_000);
    expect(claimedDocs).toEqual({
      mode: "reconnect",
      requestedResources: [GOOGLE_DOC_RESOURCE.urlPattern],
    });
    expect(beginStoredOAuthFlow(kv, "init-bigquery", "oauth-bigquery", 5_000)?.scopes)
      .toContain("https://www.googleapis.com/auth/bigquery");
    expect(claimStoredOAuthFlow(kv, "oauth-bigquery", 6_000)).toEqual({
      mode: "reconnect",
      requestedResources: [BIGQUERY_RESOURCE.urlPattern],
    });
  });

  it("rejects wrong-stage, wrong-nonce, and replay attempts without consuming the flow", () => {
    let kv = new FakeKv();
    prepareOAuthFlow(kv, "init", [], "connect", 0);

    expect(claimStoredOAuthFlow(kv, "init", 1)).toBeNull();
    expect(beginStoredOAuthFlow(kv, "wrong", "oauth", 1)).toBeNull();
    expect(beginStoredOAuthFlow(kv, "init", "oauth", 1)).not.toBeNull();
    expect(beginStoredOAuthFlow(kv, "init", "other", 2)).toBeNull();
    expect(claimStoredOAuthFlow(kv, "wrong", 2)).toBeNull();
    expect(claimStoredOAuthFlow(kv, "oauth", 2)).toEqual({
      mode: "connect", requestedResources: [],
    });
    expect(claimStoredOAuthFlow(kv, "oauth", 2)).toBeNull();
  });

  it("gives the initiation and OAuth stages independent ten-minute expiries", () => {
    let kv = new FakeKv();
    prepareOAuthFlow(kv, "init", [], "connect", 0);
    expect(beginStoredOAuthFlow(kv, "init", "oauth", TEN_MINUTES)).toBeNull();

    prepareOAuthFlow(kv, "init", [], "connect", 0);
    expect(beginStoredOAuthFlow(kv, "init", "oauth", TEN_MINUTES - 1)).not.toBeNull();
    expect(claimStoredOAuthFlow(kv, "oauth", 2 * TEN_MINUTES - 1)).toBeNull();

    prepareOAuthFlow(kv, "init", [], "connect", 0);
    expect(beginStoredOAuthFlow(kv, "init", "oauth", TEN_MINUTES - 1)).not.toBeNull();
    expect(claimStoredOAuthFlow(kv, "oauth", 2 * TEN_MINUTES - 2)).not.toBeNull();
  });

  it("does not accept legacy nonce-only state", () => {
    let kv = new FakeKv();
    kv.put("nonce", { value: "legacy", expiresAt: TEN_MINUTES, stage: "initiation" });

    expect(beginStoredOAuthFlow(kv, "legacy", "oauth", 0)).toBeNull();
    expect(claimStoredOAuthFlow(kv, "legacy", 0)).toBeNull();
  });

  it.each<OAuthFlowMode>(["connect", "auth", "reconnect"])(
    "preserves %s mode independently of an empty resource list", mode => {
      let kv = new FakeKv();
      prepareOAuthFlow(kv, "init", [], mode, 0);

      expect(beginStoredOAuthFlow(kv, "init", "oauth", 1)).toEqual({
        oauthNonce: "oauth", scopes: IDENTITY_SCOPES,
      });
      expect(claimStoredOAuthFlow(kv, "oauth", 2)).toEqual({ mode, requestedResources: [] });
    },
  );

  it("clears obsolete pending-flow keys when preparing a new flow", () => {
    let kv = new FakeKv();
    for (let key of ["nonce", "requestedScopes", "requestedResources", "reconnecting", "ephemeral"]) {
      kv.put(key, "legacy");
    }

    prepareOAuthFlow(kv, "init", [], "auth", 0);

    for (let key of ["nonce", "requestedScopes", "requestedResources", "reconnecting", "ephemeral"]) {
      expect(kv.data.has(key)).toBe(false);
    }
  });
});
