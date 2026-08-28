/** The connected account's access to a Search Console property. */
export interface SearchConsoleProperty {
  /** The property identifier, such as `sc-domain:example.com` or `https://example.com/`. */
  siteUrl: string;
  /** The connected account's Search Console permission level. */
  permissionLevel:
    | "siteOwner"
    | "siteFullUser"
    | "siteRestrictedUser"
    | "siteUnverifiedUser";
}

/** Processing information for one submitted sitemap. */
export interface SearchConsoleSitemap {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  type: string;
  warnings: number;
  errors: number;
  /** Counts submitted by content type. Google no longer provides a reliable indexed count. */
  contents: Array<{ type: string; submitted: number }>;
}

/** One structured-data item detected in Google's indexed version of a URL. */
export interface SearchConsoleRichResultItem {
  name?: string;
  issues: Array<{ severity: string; message: string }>;
}

/** Google index information for one URL. */
export interface SearchConsoleUrlInspection {
  inspectionUrl: string;
  inspectionResultLink?: string;
  verdict: "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL" | "VERDICT_UNSPECIFIED";
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  crawledAs?: string;
  sitemaps: string[];
  referringUrls: string[];
  richResults?: {
    verdict: string;
    detectedItems: Array<{
      richResultType: string;
      items: SearchConsoleRichResultItem[];
    }>;
  };
}

/** Read-only access to one Search Console property. */
export interface SearchConsoleSession {
  /** Returns the bound property and the connected account's permission level. */
  getProperty(): Promise<SearchConsoleProperty>;

  /** Lists submitted sitemaps and their latest processing information. */
  listSitemaps(options?: { sitemapIndex?: string }): Promise<SearchConsoleSitemap[]>;

  /** Returns Google's indexed-version inspection result for a URL in this property. */
  inspectUrl(
    url: string,
    options?: { languageCode?: string },
  ): Promise<SearchConsoleUrlInspection>;
}
