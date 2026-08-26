# MOP-564 M7 — Personal MVP final verification

Date: 2026-08-26 (JST)

## Scope decision

- M5 (verification AWS design/build): NOT APPLICABLE to the Personal product line.
- M6 (manual import into verification AWS): NOT APPLICABLE to the Personal product line.
- Personal runs on the owner's local Cloudflare OS environment and is reachable only through localhost/Tailscale. AWS belongs to the later Nnet/customer lines.

## Verification result

Status: PASS

### Secrets

- Representative `.gadget` package decoded to `client.js` and `server.js` with zero secret findings.
- Product source scan found no private-key, AWS, GitHub, Slack, or OpenAI credential patterns outside test fixtures and the detector definition.
- Package publication now fails closed when common credential formats are found and never repeats the matched value.

### Permissions and external effects

- All three representative Gadgets use synthetic fixtures and perform no external writes.
- The packaged CSV Gadget declares no bindings, so it carries no ambient external capability.
- Context E2E used a read-only Context binding; grounded and answer-unavailable behavior passed.

### Model route and usage

- Codex Subscription is a distinct `codex` provider route and bypasses AI Gateway/API-key routing.
- If the local bridge is unavailable, the request fails closed; it does not fall back to a paid API.
- The subscription bridge reports zero monetary cost, so subscription usage does not enter the API budget.
- Follow-up: the bridge currently returns no token counts, so the UI records zero tokens. Add request count, model, workspace/Gadget, outcome, and optional subscription-reported token usage when the provider exposes it.

### Rollback

- Proposed chat changes can be discarded before acceptance.
- Accepted code is commit-backed; subsequent proposed changes can be reverted through the chat change lifecycle.
- Blueprint packages are immutable by version in R2 (`<blueprintId>/<version>`); code updates create the next version rather than overwriting the prior object.
- Automated rollback/change-history verification passed in backend and frontend suites.

## Tests

- Backend route, secret-scan, and change-history suites: 68 passed.
- Frontend compaction/rollback suite: 25 passed.
- Workshop backend TypeScript checks: passed.
- Repository lint: passed with pre-existing warnings only.

## MVP conclusion

M1–M4 and the Personal-relevant M7 checks are complete. M5–M6 were removed from Personal scope because AWS is not part of the Personal architecture. Package re-import, subscription usage metadata, and automated local backup/restore evidence are complete.

Personal MVP was closed on 2026-08-26. Nnet planning starts from the separate
[Personal and Nnet AI routing decision](../architecture/nnet-ai-routing.md);
AWS deployment work is not part of this completed Personal milestone.

## Follow-up closure — package re-import regression

- Added a dedicated `.gadget` archive round-trip test.
- The test creates a gzip-compressed Yjs snapshot, packages it with versioned Blueprint metadata, parses it through the production archive reader, and reconstructs the files.
- Version 3, all metadata, compressed content length, `client.js`, and `server.js` survive the round trip unchanged.
- The reconstructed files produce zero secret findings.
- Package round-trip plus secret scanner verification: 8 tests passed.
- Workshop backend TypeScript check and repository lint passed.

## Follow-up closure — subscription usage metadata

- Added one structured completion event per Codex Subscription inference.
- Recorded fields: model ID, provider, explicit `subscription` route, success/error outcome, duration, and tool-call count.
- Ambient observability supplies the enclosing chat/workspace operation context without introducing another store.
- Prompt, response, bridge URL, authentication data, and monetary cost are excluded from the event.
- Non-2xx bridge diagnostics are discarded; only the HTTP status is returned to chat and logs.
- Success, failure, fail-closed routing, and content non-exposure verification: 29 tests passed.
- Token counts remain zero because the local subscription bridge does not receive them from Codex; this is now distinguishable from paid API usage through `modelRoute: subscription`.

## Follow-up closure — local backup and restore

- Added `personal:backup`, `personal:backup:verify`, and `personal:restore` commands for local Wrangler state.
- Each archive contains a versioned manifest with path, size, and SHA-256 for every file. Verification rejects unsafe archive paths, mismatched file lists/checksums, and failed SQLite integrity checks.
- Restore is fail-closed when its target already exists and never overwrites the active `.wrangler` state.
- Live rehearsal archive: `backups/personal-state-2026-08-26T1750-JST.tar.gz` (gitignored, 2,866,587 compressed bytes).
- Verified payload: 229 files, 18,799,785 bytes, including 91 SQLite databases with `PRAGMA integrity_check = ok`.
- Restored into `/private/tmp/mopro-personal-restore-20260826-1750/state-v3`; the active state remained at `.wrangler/state/v3`.
- Backup/restore regression: 1 test passed. Script TypeScript check passed.
- The development server restarted with the original state and returned HTTP 200 at `http://localhost:8787/`; the Codex subscription bridge was not restarted.
