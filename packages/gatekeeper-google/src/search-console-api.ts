import { AccessTokenProvider, fetchWithAuthRetry } from "./auth-retry";
import type {
  SearchConsoleProperty, SearchConsoleSitemap, SearchConsoleUrlInspection,
} from "./search-console-types";

const WEBMASTERS_API = "https://www.googleapis.com/webmasters/v3";
const INSPECTION_API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function number(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return 0;
}

async function boundedText(response: Response): Promise<string> {
  let declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Search Console response was too large.");
  }
  if (!response.body) return "";
  let reader = response.body.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      let {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error("Search Console response was too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let bytes = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export class SearchConsoleApi {
  constructor(private getAccessToken: AccessTokenProvider) {}

  async #request(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    let response = await fetchWithAuthRetry(
      url, init, this.getAccessToken, {timeoutMs: REQUEST_TIMEOUT_MS},
    );
    let text = await boundedText(response);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Search Console returned invalid JSON [http=${response.status}].`);
    }
    if (!response.ok) {
      let root = record(body, `Search Console request failed [http=${response.status}].`);
      let error = root.error && typeof root.error === "object" ? record(root.error, "") : undefined;
      let detail = string(error?.message);
      throw new Error(
        `Search Console request failed [http=${response.status}]${detail ? `: ${detail}` : ""}`,
      );
    }
    return record(body, "Search Console returned an invalid response.");
  }

  async listProperties(): Promise<SearchConsoleProperty[]> {
    let body = await this.#request(`${WEBMASTERS_API}/sites`);
    if (!Array.isArray(body.siteEntry)) return [];
    return body.siteEntry.flatMap(value => {
      let item = record(value, "Search Console returned an invalid property.");
      let siteUrl = string(item.siteUrl);
      let permissionLevel = string(item.permissionLevel);
      if (!siteUrl || !permissionLevel || ![
        "siteOwner", "siteFullUser", "siteRestrictedUser", "siteUnverifiedUser",
      ].includes(permissionLevel)) return [];
      return [{siteUrl, permissionLevel} as SearchConsoleProperty];
    });
  }

  async getProperty(siteUrl: string): Promise<SearchConsoleProperty> {
    let body = await this.#request(`${WEBMASTERS_API}/sites/${encodeURIComponent(siteUrl)}`);
    let returnedSiteUrl = string(body.siteUrl);
    let permissionLevel = string(body.permissionLevel);
    if (!returnedSiteUrl || !permissionLevel || ![
      "siteOwner", "siteFullUser", "siteRestrictedUser", "siteUnverifiedUser",
    ].includes(permissionLevel)) {
      throw new Error("Search Console returned invalid property metadata.");
    }
    return {siteUrl: returnedSiteUrl, permissionLevel} as SearchConsoleProperty;
  }

  async listSitemaps(siteUrl: string, sitemapIndex?: string): Promise<SearchConsoleSitemap[]> {
    let url = new URL(`${WEBMASTERS_API}/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
    if (sitemapIndex) url.searchParams.set("sitemapIndex", sitemapIndex);
    let body = await this.#request(url.toString());
    if (!Array.isArray(body.sitemap)) return [];
    return body.sitemap.map(value => {
      let item = record(value, "Search Console returned an invalid sitemap.");
      return {
        path: string(item.path) ?? "",
        ...(string(item.lastSubmitted) ? {lastSubmitted: string(item.lastSubmitted)} : {}),
        ...(string(item.lastDownloaded) ? {lastDownloaded: string(item.lastDownloaded)} : {}),
        isPending: item.isPending === true,
        isSitemapsIndex: item.isSitemapsIndex === true,
        type: string(item.type) ?? "unknown",
        warnings: number(item.warnings),
        errors: number(item.errors),
        contents: Array.isArray(item.contents) ? item.contents.map(content => {
          let entry = record(content, "Search Console returned invalid sitemap contents.");
          return {type: string(entry.type) ?? "unknown", submitted: number(entry.submitted)};
        }) : [],
      };
    });
  }

  async inspectUrl(
    siteUrl: string, inspectionUrl: string, languageCode = "ja-JP",
  ): Promise<SearchConsoleUrlInspection> {
    let body = await this.#request(INSPECTION_API, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({siteUrl, inspectionUrl, languageCode}),
    });
    let result = record(body.inspectionResult, "Search Console returned no inspection result.");
    let index = record(result.indexStatusResult, "Search Console returned no index status.");
    let verdict = string(index.verdict) ?? "VERDICT_UNSPECIFIED";
    let rich = result.richResultsResult && typeof result.richResultsResult === "object"
      ? record(result.richResultsResult, "") : undefined;
    return {
      inspectionUrl,
      ...(string(result.inspectionResultLink)
        ? {inspectionResultLink: string(result.inspectionResultLink)} : {}),
      verdict: (["PASS", "PARTIAL", "FAIL", "NEUTRAL", "VERDICT_UNSPECIFIED"].includes(verdict)
        ? verdict : "VERDICT_UNSPECIFIED") as SearchConsoleUrlInspection["verdict"],
      ...Object.fromEntries([
        "coverageState", "robotsTxtState", "indexingState", "lastCrawlTime",
        "pageFetchState", "googleCanonical", "userCanonical", "crawledAs",
      ].flatMap(key => string(index[key]) ? [[key, string(index[key])]] : [])),
      sitemaps: strings(index.sitemap),
      referringUrls: strings(index.referringUrls),
      ...(rich ? {richResults: {
        verdict: string(rich.verdict) ?? "VERDICT_UNSPECIFIED",
        detectedItems: Array.isArray(rich.detectedItems) ? rich.detectedItems.map(value => {
          let detected = record(value, "Search Console returned invalid rich-result data.");
          return {
            richResultType: string(detected.richResultType) ?? "unknown",
            items: Array.isArray(detected.items) ? detected.items.map(itemValue => {
              let item = record(itemValue, "Search Console returned invalid rich-result item.");
              return {
                ...(string(item.name) ? {name: string(item.name)} : {}),
                issues: Array.isArray(item.issues) ? item.issues.map(issueValue => {
                  let issue = record(issueValue, "Search Console returned invalid rich-result issue.");
                  return {
                    severity: string(issue.severity) ?? "SEVERITY_UNSPECIFIED",
                    message: string(issue.issueMessage) ?? "Unknown issue",
                  };
                }) : [],
              };
            }) : [],
          };
        }) : [],
      }} : {}),
    } as SearchConsoleUrlInspection;
  }
}
