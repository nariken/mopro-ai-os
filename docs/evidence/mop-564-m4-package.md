# MOP-564 M4 — Versioned Gadget package and secret scan

Date: 2026-08-26 (JST)

Status: PASS

## Implementation

- `.gadget` archives already carry `BlueprintMetadata.version`; creation starts at version 1 and a code update increments it.
- Download filenames already include the version suffix (`<title>-v<version>.gadget`).
- Added a fail-closed scan at the shared publishability checkpoint used by initial Blueprint creation and code-version updates.
- The scanner detects private keys, AWS access keys, GitHub tokens, Slack tokens, OpenAI API keys, and long assigned credentials.
- Findings expose only path, line number, and credential kind; the matched value is never returned in the error.
- Packaging and scanning run locally in the Worker and send no source content to an external service.

## Automated verification

- Secret scanner: 7 tests passed.
- Workshop backend browser and default TypeScript builds passed.
- Repository lint passed with pre-existing warnings only.

## Representative package verification

- Gadget: `予算実績 CSV分析`
- Blueprint ID: `e9d1465a0185e88bca887b3f737e0909`
- Version: `v1`
- Bindings: none
- Package code snapshot: 4,932 compressed bytes
- Files: `client.js`, `server.js`
- Secret findings after decompressing and decoding the stored package snapshot: none
- The Blueprint detail page displayed `v1`; `Download archive` completed without an application error.

## Constraints

- Pattern-based scanning is a guardrail, not a substitute for keeping credentials in gatekeepers or secret bindings.
- The scanner intentionally avoids echoing matched values and may require future detector additions as credential formats evolve.
