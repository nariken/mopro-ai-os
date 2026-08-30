# ADR: Workforce Compiler M2 placement decision architecture

Date: 2026-08-30
Status: Accepted for Stage 8 implementation (MOP-589)
Contract: `docs/workforce-compiler-m2-design.md`
Input: MOP-588 Human Acceptance, 2026-08-30 JST
M1 baseline: `8ad49a21fff35929c9273cdcb9ac64d75e0b7745`

M2 compares four execution candidates (`ai`, `existing_staff`, `hire`, `outsource`) for each M1
Task and produces a draft placement proposal. These records capture the choices that were live, what
was chosen, and why the alternatives were rejected. Each record is independently reversible; a change
to any of them bumps `ruleSetVersion`.

---

## ADR-M2-001 — Sidecar analysis document rather than an M1 schema extension

### Context

M1's `WorkforceDefinition` is `schemaVersion: "1.0.0"`, closed at every object level
(`additionalProperties: false`), and pins `Task.executionType` to the literal `"undecided"`. The
accepted contract requires that the canonical M1 fixture load unmodified, that M2's absence produce
an explicit `undecided`, and that the M1 viewer and approval card keep working.

### Options

1. Bump M1 to `1.1.0` and add optional M2 fields inline on `Task`.
2. Add a sidecar `WorkforcePlacementAnalysis` document bound to M1 by id, version, and content digest.
3. Write a v2 schema that supersedes M1 and migrate the fixture.

### Decision

Option 2. M1's schema, types, validator, fixture, and `.` export surface are not modified. M2 lives
under `src/m2/` and reads the M1 document as immutable input.

### Consequences

- Back-compat becomes structural rather than test-enforced: M1 code that never imports M2 cannot
  observe an M2 change. The 12 M1 tests keep passing because nothing they cover moved.
- Two documents must be kept in sync, which is why `definitionRef.contentDigest` exists — drift is a
  detectable error rather than a silently wrong answer (see ADR-M2-010).
- Writing a confirmed placement back into `Task.executionType` is deferred and will need an M1 schema
  bump. That is recorded as an open Human decision, not assumed here.

### Rejected

Option 1 widens `executionType` away from the `"undecided"` literal and forces every M1 consumer to
accept `1.1.0`, which is exactly the back-compat risk the contract forbids. Option 3 discards the
accepted, reviewed, GUI-verified M1 baseline to add a feature that is additive by nature.

---

## ADR-M2-002 — Integer-only scoring with 5-divisible weights

### Context

The accepted weights are capability 35, capacity/time 20, quality/risk 20, total cost 15,
reversibility/learning value 10. The contract requires byte-equivalent output for identical input and
`ruleSetVersion`, verified over 100 repeated runs.

### Options

1. Floating-point weighted mean of normalized 0–1 component values.
2. Integer 0–5 sub-scores multiplied by `weight / 5`, with all comparisons cross-multiplied.
3. Fixed-point decimal arithmetic with an explicit rounding mode.

### Decision

Option 2. Every weight is divisible by 5, so `componentPoints = (weight / 5) × subScore` is exact
integer multiplication: 7, 4, 4, 3, and 2 points per sub-score step, total 0–100. Band thresholds are
written as integer cross-multiplications (`4 × ready ≤ slack`, never `ratio ≤ 0.25`). All quantities
are canonicalized to integer minutes/year, minor-currency-unit/year, and events/year first.

### Consequences

- Determinism needs no rounding rule, no epsilon comparison, and no tie-break-by-float-noise. There is
  no floating-point value anywhere on the score path.
- A value that cannot be canonicalized to a finite integer is fail-closed
  (`UNIT_NOT_CANONICALIZABLE`) rather than approximated.
- Sub-scores are coarse by construction (six levels). This is accepted: the output is a comparison
  aid for a Human, and false precision would be worse than coarseness.
- A period-conversion constant table (`day: 365, week: 52, month: 12, quarter: 4, year: 1`) is now
  part of the versioned rule set. It is conventional, so it must be version-pinned rather than
  treated as a fact.

### Rejected

Option 1 makes byte-equivalence depend on IEEE-754 evaluation order and would need an epsilon policy
for the tie rule, which is precisely where "no automatic tie-break" must be exact. Option 3 adds a
dependency and a rounding-mode decision to buy precision the rubric does not have.

---

## ADR-M2-003 — Cost scored against the task's own baseline, not against rival candidates

### Context

`totalCost` carries 15 of 100 points. Costs must be comparable across candidates whose setup and run
profiles differ, over a stated horizon.

### Options

1. Rank-relative: cheapest eligible candidate gets 5, others scaled down from it.
2. Baseline-absolute: score `setupCost + runCost × horizonYears` against the task's current cost over
   the same horizon.
3. Absolute currency bands (e.g. under ¥100k → 5).

### Decision

Option 2, with `evaluationHorizonYears ∈ {1, 2, 3}` as a required header field so setup and run costs
are commensurable, and `currentState.costPerPeriod` as the denominator.

### Consequences

- A candidate's cost score is independent of which other candidates exist. Adding or removing a
  candidate cannot silently change another's score, which keeps the sensitivity analysis honest.
- A missing or zero cost baseline is fail-closed (`MISSING_COST_BASELINE`). A ratio against an absent
  baseline is not a comparison, and imputing one would be the "substitute 0 for missing" behavior the
  contract bans.
- Horizon choice materially affects setup-heavy candidates (`ai`, `hire`). It is therefore an explicit
  analyst input recorded in the header and shown in the UI, not a hidden constant.

### Rejected

Option 1 couples every candidate's score to the field, so removing an ineligible rival can change the
winner — indefensible in an approval card. Option 3 hard-codes currency-specific magnitudes into a
rule set that must survive different task sizes.

---

## ADR-M2-004 — Analyst-rated 0–5 rubrics plus a per-candidate shape adjustment for capability

### Context

Capability carries 35 of 100 points — the largest weight — and must be explainable to a Human who is
being asked to approve a placement.

### Options

1. Derive capability entirely from raw measured quantities (throughput, error counts, cycle time).
2. Analyst-rated 0–5 rubrics with published anchors, combined by a published integer formula.
3. Free-form analyst capability score with prose justification.

### Decision

Option 2. Capability is `clamp(0, 5, skillFitBase + shapeAdjust)`, where `skillFitBase` comes from the
worst required-skill gap (0→5, 1→4, 2→2, 3→1, ≥4→0) and `shapeAdjust ∈ [−2, +1]` applies only to `ai`
and `outsource`, computed from the work-characteristic rubrics.

### Consequences

- `shapeAdjust` is 0 for `existing_staff` and `hire` on purpose. A human's capability on a task is
  skill fit; a repeatable, highly digital task does not make a person *less* able to do it. Applying
  the AI-shaped fit vector to human candidates would have encoded a systematic bias toward `ai` on
  exactly the tasks where the comparison matters most. This is the single most reviewable assumption
  in the rule set and is called out for Stage 9.
- Rubric anchors are published per dimension with explicit polarity (`exceptionRate` and
  `judgmentEmpathy` rise with *more* exceptions and *more* judgment), so the sign of every term is
  readable from the field name.
- `confidence` is rated but deliberately excluded from the score and surfaced in the approval card
  instead, so a high score resting on a guess is visible rather than discounted invisibly.

### Rejected

Option 1 is unavailable: M2 is synthetic and offline, and the measurements do not exist for `hire` or
`outsource` by definition. Option 3 makes the score unauditable and lets Agent prose set the number,
which the contract forbids.

---

## ADR-M2-005 — Total gate evaluation with verdict precedence, no short-circuit

### Context

Four candidates must always be evaluated, each with versioned reason codes, and the UI must show why
each excluded candidate was excluded.

### Options

1. Short-circuit on the first blocking rule (cheapest, one reason code).
2. Evaluate every rule for every candidate; verdict precedence `ineligible` > `unknown` > `eligible`.

### Decision

Option 2, with reason codes sorted lexicographically and candidates emitted in the fixed order
`["ai", "existing_staff", "hire", "outsource"]`.

### Consequences

- A candidate blocked for three independent reasons reports all three. Fixing one does not surface a
  new objection on the next run, which is what makes the "minimum additional questions" output
  trustworthy.
- Rule evaluation order becomes irrelevant to the output, removing a whole class of nondeterminism.
- `eligible` implies every candidate-scoped score input is present and not `unverified`. This
  invariant is asserted in code and in tests, and it is what licenses the scorer to read inputs
  directly with no null-coalescing default.
- Slightly more computation per task; irrelevant at this scale.

### Rejected

Option 1 makes the output depend on rule ordering and produces a misleading "fix this one thing"
signal.

---

## ADR-M2-006 — `assumed` evidence passes the gate; only `unverified` blocks

### Context

The contract fails closed on missing critical evidence. M1 also forbids synthetic documents from
claiming `observed` evidence.

### Options

1. Require `observed` for all critical inputs.
2. Accept `observed` and `assumed`; block `unverified`.
3. Accept everything and report status only.

### Decision

Option 2, split by level: `unverified` on a **candidate-scoped** input makes that candidate
`unknown`; `unverified` on a **task-level** input (`demand`, `currentState`, `operatingConstraints`)
makes the whole task `undecided`.

### Consequences

- Synthetic fixtures remain testable. Under option 1 every synthetic document would be `undecided` by
  construction — the M1 rule and the M2 gate would contradict each other and the entire four-candidate
  comparison would be unexercisable.
- Every `assumed` input is emitted in `assumptions[]` and rendered separately in the UI, so leniency
  at the gate is paid for with visibility at the decision.
- The candidate/task split means one weak vendor estimate disqualifies one candidate rather than
  killing the whole comparison.

### Rejected

Option 1 is self-defeating as above. Option 3 removes the fail-closed guarantee the contract requires.

---

## ADR-M2-007 — Recommendation margin of 5 points, ties never broken automatically

### Context

The contract requires `human_choice` on ties and forbids automatic tie-breaking.

### Options

1. Recommend whenever a strict maximum exists (margin ≥ 1).
2. Recommend only when the margin reaches a threshold; otherwise `human_choice`.
3. Recommend the top candidate and list the tie in prose.

### Decision

Option 2 with `MIN_RECOMMENDATION_MARGIN = 5`, which is one full step of the smallest-weighted
component (reversibility/learning value, 2 points per step) plus more — i.e. a margin no single
one-step rubric change can manufacture on the cheapest axis. `eligibleCount === 1` with any `unknown`
rival is also `human_choice` (`SOLE_ELIGIBLE_WITH_UNKNOWN_RIVALS`): one survivor is not a comparison
when the rivals were never evaluated.

### Consequences

- `ranking` is still a strict total order (score desc, then canonical candidate order) so output stays
  byte-equivalent, but rank 1 is explicitly not a recommendation unless the margin clears the
  threshold. The two concepts are separated in the result type.
- Some genuinely close calls reach a Human. That is the intended failure direction.
- The threshold is a judgment call and is flagged as an open Human decision: whether it should scale
  with task risk level is deliberately left unanswered rather than guessed.

### Rejected

Option 1 turns rubric noise into a recommendation. Option 3 hides the tie in text that the validator
cannot check.

---

## ADR-M2-008 — Skill Gap for every eligible candidate; the other three artifacts only for the selection

### Context

Four draft artifacts are in M2 scope. Skill Gap is contract-defined as common to all candidates; AI
Agent Spec, JD, and SOW are candidate-specific.

### Options

1. Generate all four artifact types for every eligible candidate.
2. Generate Skill Gap for every eligible candidate; generate the other three only for the
   Human-confirmed `executionType`.
3. Generate nothing until a selection exists.

### Decision

Option 2. With no confirmed selection, only Skill Gap artifacts are produced. `existing_staff` and
`hire` both produce a JD, distinguished by `jdMode` (`role_assignment_draft` vs `hiring_draft`).

### Consequences

- Skill Gap feeds the comparison itself, so it must exist before a decision. The other three describe
  how a chosen arrangement would be operated, so generating them for rejected candidates would produce
  documents that read as commitments nobody made.
- The reader always has gap information for every viable option, which is what makes `human_choice`
  actionable rather than a dead end.
- Artifact generation is a pure function of the result plus the selection, so it needs no extra
  determinism machinery.

### Rejected

Option 1 produces up to 13 draft documents per task, most of them describing paths that were rejected
— a real hazard when a draft SOW for a non-selected vendor path can be mistaken for an intent to
contract. Option 3 withholds the Skill Gap information the decision depends on.

---

## ADR-M2-009 — `generatedAt` is propagated, never read from the clock

### Context

Output must be byte-equivalent across 100 runs, and every artifact carries a timestamp.

### Options

1. Each artifact stamps `Date.now()` at generation.
2. Every derived object copies `analysis.generatedAt`; the compiler reads no clock.

### Decision

Option 2, enforced by the `ARTIFACT_CLOCK_DRIFT` invariant and by a self-check that evaluates twice
and compares the canonical JSON of both results, failing closed with `NONDETERMINISTIC_RESULT` on any
difference.

### Consequences

- The 100-run determinism test is meaningful. Under option 1 it would fail for a trivial reason and
  the natural fix — excluding timestamps from the comparison — would also mask real nondeterminism.
- A timestamp in the output means "the analyst asserted this input set at this time", not "this
  process ran at this time". That is the more useful claim for an approval record anyway.
- The self-check doubles evaluation cost. At this scale that is free, and it converts a determinism
  regression from a plausible-looking wrong answer into a refusal.

### Rejected

Option 1 makes determinism untestable without carving holes in the comparison.

---

## ADR-M2-010 — Caller-supplied definition digest with a synchronous validator

### Context

The sidecar must be provably bound to the M1 revision it was written against. The validator is
consumed by both a Node test suite and a browser Gadget, and M1's `validateWorkforceDefinition` is
synchronous.

### Options

1. Async validator that hashes internally via Web Crypto.
2. Synchronous validator; the caller passes `definitionDigest`, computed by an exported async
   `computeDefinitionDigest`.
3. Bind by `definitionId` alone, with no digest.

### Decision

Option 2. `validatePlacementAnalysis(definition, analysis, { definitionDigest })` stays synchronous
and does no hashing. Omitting the digest is `DEFINITION_DIGEST_MISSING`; a mismatch is
`DEFINITION_DIGEST_MISMATCH`. The digest is `sha256-<hex>` over RFC 8785 JCS-canonicalized JSON.

### Consequences

- The M1 and M2 validators keep the same call shape, so the Gadget composes them without an async
  boundary in the middle of a render path.
- Hashing uses Web Crypto, present in Node 18+ and browsers — no dependency and no network call.
- Callers carry one extra step. Making the digest optional would have made the security property
  optional too, so the missing-digest case is an error, not a soft pass.

### Rejected

Option 1 forces the whole validation path async for one hash. Option 3 lets an analysis silently
score against an edited definition, which is the failure mode most likely to produce a confident
wrong recommendation.

---

## ADR-M2-011 — Placement approval is a separate, non-transferable action type

### Context

The contract requires that confirming `executionType` be gated, and that job posting, candidate
contact, contracting, hiring, budget, account connection, agent external write, and real-data
ingestion each be separately gated.

### Options

1. Reuse M1's `ApprovalActionType` union, extended with the new values.
2. Define an independent `M2ApprovalActionType` in `src/m2/types.ts` with `placement_commit` as the
   only action M2 itself can propose.

### Decision

Option 2, plus a fixed non-editable `scopeStatement` on every card stating that the approval records a
placement decision only and authorizes none of the downstream actions.

### Consequences

- M1's exported type surface stays byte-identical, satisfying ADR-M2-001's back-compat rule.
- The downstream action types exist in the M2 union as *declarable gates* inside artifacts (an AI
  Agent Spec lists which approvals its tools would require), while `placement_commit` is the only one
  M2 can itself put on a card. Declaring a future gate and requesting one are kept distinct.
- `state: "executed"` is rejected in M2 for the same reason M1 rejects it: there is no executor, so an
  `executed` record could only be false.

### Rejected

Option 1 mutates an M1 type that M1 consumers depend on, to express states M1 has no concept of.
