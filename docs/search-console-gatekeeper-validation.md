# Search Console Gatekeeper validation

Last validated: 2026-08-28

## Scope

The Google Gatekeeper can connect one Search Console property with the
`webmasters.readonly` OAuth scope. The agent-facing session supports:

- reading the connected property and permission level;
- listing submitted sitemaps and their last submitted/downloaded timestamps, status, warnings,
  errors, and submitted URL counts;
- inspecting the indexed state of a URL belonging to the connected property.

It does not expose sitemap submission, removal, indexing requests, or other Search Console writes.
Those actions require a separate operator decision and must be performed outside this read-only
binding.

## Local end-to-end result

The connection was validated against `sc-domain:nariken.ai` with `siteOwner` permission through the
local Workshop at `http://127.0.0.1:8787`.

- Google OAuth completed successfully after enabling the Search Console API for the OAuth project.
- The property picker listed both domain and URL-prefix properties available to the account.
- The selected property was attached to a chat as `SEARCH_CONSOLE`.
- The agent read sitemap metadata and performed URL Inspection requests without receiving a write
  capability.
- Sitemap and URL-inspection calls were recorded as observations.

At validation time, `sitemap-posts.xml` initially reported 26 submitted URLs from its 2026-08-16
download, while the live sitemap contained 28. An operator subsequently resubmitted it through the
Search Console UI; Search Console then reported a successful 2026-08-28 read with 28 detected URLs.

## API limitations

The Search Console API does not provide the full Page Indexing report aggregates. In particular,
the binding cannot directly return the report-wide counts for “Discovered - currently not indexed”
or “Crawled - currently not indexed”. A bounded set can be classified by inspecting each known URL,
but that result is not equivalent to the complete GSC report.

The sitemap API's indexed-count field is deprecated and is not returned by this binding. Treat
`contents[].submitted` as detected/submitted URL count, not indexed count.

URL Inspection reports Google's indexed copy, not an immediate live test. A recent production
change may remain invisible until Google crawls the URL again.

## Operational follow-up

After sitemap resubmission or an indexing request, wait before rechecking. For the 2026-08-28
validation, a calendar follow-up was scheduled for 2026-08-31 to confirm:

- `sitemap-posts.xml` remains successful with 28 detected URLs;
- `/aivo/` has been crawled or indexed;
- the Article JSON-LD author-URL correction target has been recrawled or indexed;
- whether further action is warranted.
