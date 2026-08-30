# Workforce Compiler M1

User-facing vocabulary and local rerun guide for the Advertising Strategy Operator
(`marketing-ad-strategy`) M1 package.

Architecture contract: `docs/workforce-compiler-m1-design.md`.
Next milestone contract: `docs/workforce-compiler-m2-design.md` (placement decision,
not yet implemented).

## Vocabulary

| Term | Meaning |
| --- | --- |
| Business | Top-level value unit with customers, outcomes, and constraints |
| Process | Repeatable flow that contributes to a Business outcome |
| Task | Smallest reviewable unit of work owned by exactly one Process |
| Skill | Reusable capability with a 1–5 level scale; not a tool or procedure |
| Evidence | Claim metadata (`observed` / `assumed` / `unverified`) attached to values |
| Approval gate | Non-executing preview for side-effecting actions; M1 stays `draft` |

Relationships are ID-only: `Business 1..n Process`, `Process 1..n Task`, `Task n..m Skill`.

## Boundary examples

In scope for M1:

- Versioned `WorkforceDefinition` JSON Schema and semantic validator
- Synthetic fixture for Advertising Strategy Operator
- Deterministic indexes and fail-closed validation tests

Out of scope:

- AI / hire / outsource recommendations (M2; see the M2 design contract)
- JD, SOW, skill-gap, or onboarding generation (M2 and later)
- Gatekeeper bindings, credentials, network calls, production deploy
- Real ad-account actions (launch, budget change, audience upload, …)

## Layout

```text
packages/workforce-compiler/          # schema, types, validator, tests
docs/fixtures/workforce-compiler/     # synthetic fixture
docs/workforce-compiler.md            # this guide
docs/workforce-compiler-m1-design.md  # Stage 2 architecture contract
docs/workforce-compiler-m2-design.md  # Stage 7 M2 contract (design only)
docs/architecture/workforce-compiler-m2-adr.md  # M2 decision records
```

## Validate the fixture

From the repository root (after `pnpm install`):

```bash
pnpm --filter @gadgets/workforce-compiler test:run
```

Or via the cached Vite+ task:

```bash
vp run -F @gadgets/workforce-compiler test
```

The suite loads
`docs/fixtures/workforce-compiler/advertising-strategy-operator.synthetic.json`,
asserts it is valid, checks forward/reverse indexes, and rejects contract mutations
(missing fields, bad enums, broken references, approval gaps, synthetic-observed
conflicts, and every side-effecting `actionType` without a gate).

Quality Gate labels for Issue reporting:

- `合格` — all required cases pass
- `条件付き合格` — only for explicitly non-M1 environment checks
- `未合格` — any M1 contract failure

## Human Approval

Production deploy, external send/publish, credentials, real ad-account connection,
budget commitment, campaign launch/change/pause, audience upload, creative
publication, real/personal data ingestion, and destructive changes require Human
Approval. M1 is local, synthetic, and read-only.
