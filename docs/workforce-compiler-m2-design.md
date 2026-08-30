# Workforce Compiler M2 solution design

Status: Stage 7 implementation contract for MOP-589
Accepted input contract: MOP-588 Human Acceptance, 2026-08-30 JST
M1 baseline: `mopro/personal-mvp` at `8ad49a21fff35929c9273cdcb9ac64d75e0b7745` (PR #6)
Target occupation: Advertising Strategy Operator (`marketing-ad-strategy`)
Rule set identity: `wc-m2-rules/1.0.0`
Decision records: `docs/architecture/workforce-compiler-m2-adr.md`

M2 turns a validated M1 `WorkforceDefinition` plus a Business Analyst extension into a
**draft placement proposal**: for every in-scope Task, all four candidates
(`ai`, `existing_staff`, `hire`, `outsource`) are gated, the eligible ones are scored on a
version-pinned integer rubric, and the result is `recommended`, `human_choice`, or `undecided`.
M2 is local, synthetic, read-only, and deterministic. It does not place anyone, publish anything,
contact anyone, commit budget, connect an account, deploy, or call an external service.

## Decision summary

- M2 is a **sidecar document**, `WorkforcePlacementAnalysis`, bound to an M1 document by
  `definitionId` + `schemaVersion` + content digest. The M1 schema, types, validator, fixture, and
  public export surface are **not modified**. M1 back-compat is structural, not test-enforced.
- All scoring arithmetic is **integer only**. The five fixed weights (35 / 20 / 20 / 15 / 10) are all
  divisible by 5, so a 0–5 sub-score maps to points by exact integer multiplication with no rounding
  and no floating point anywhere on the score path.
- All quantities are normalized to **canonical integer units** (minutes/year, currency-minor-unit/year,
  events/year) before any comparison. Band thresholds are evaluated by integer cross-multiplication,
  never by floating division. A value that cannot be canonicalized is fail-closed, not approximated.
- The feasibility gate is **total**: every rule is evaluated for every candidate, no short-circuit.
  Verdict precedence is `ineligible` > `unknown` > `eligible`, and every verdict carries sorted,
  version-pinned reason codes.
- `eligible` implies **every score input for that candidate is present and not `unverified`**. Scoring
  therefore never imputes, never substitutes 0 for missing, and never divides by an absent baseline.
- Ties are never broken automatically. A top-1 margin below `MIN_RECOMMENDATION_MARGIN` (5 points)
  yields `human_choice`.
- `generatedAt` is propagated from the analysis header into every derived artifact. The compiler
  reads no wall clock, so 100 runs of the same input produce byte-equivalent output.
- Confirming `executionType` into the SSOT requires a Human Approval Card. That approval authorizes
  **the placement record only**; every downstream external action is a separate approval.

## Artifact topology

Stage 8 (deterministic core) should use this layout. Nothing under `src/` outside `src/m2/` changes.

```text
packages/workforce-compiler/
  package.json                              # add "./m2" export subpath only
  src/
    schema/workforce-definition.schema.json # UNCHANGED (M1)
    types.ts                                # UNCHANGED (M1)
    validate.ts                             # UNCHANGED (M1)
    index.ts                                # UNCHANGED (M1)
    m2/
      schema/placement-analysis.schema.json
      schema/placement-result.schema.json
      schema/artifacts.schema.json
      types.ts          # M2 domain + result + artifact types
      rules.ts          # RULE_SET_VERSION, weights, rubrics, bands, reason codes (data only)
      canonical.ts      # unit canonicalization to integers; digest helper
      gate.ts           # feasibility gate
      score.ts          # integer scoring and ranking
      sensitivity.ts    # one-step and cost-range perturbation
      decide.ts         # decision assembly and fail-closed policy
      artifacts.ts      # four draft artifact generators
      validate.ts       # schema + semantic validation of the analysis document
      index.ts          # M2 public surface
  __tests__/
    validate.test.ts                        # UNCHANGED (M1, 12 cases)
    m2/*.test.ts
docs/fixtures/workforce-compiler/
  advertising-strategy-operator.synthetic.json   # UNCHANGED (M1 canonical)
  m2/*.json                                      # M2 fixtures
docs/workforce-compiler-m2-design.md
docs/architecture/workforce-compiler-m2-adr.md
```

`packages/workforce-compiler/src/m2` stays a pure TypeScript library: no Worker, storage, RPC,
model, credential, or network dependency. The Gadget consumes its output and must not re-implement
any rule.

## Binding to M1 and migration

```ts
interface DefinitionRef {
  definitionId: string;          // must equal definition.definitionId
  schemaVersion: "1.0.0";        // must equal definition.schemaVersion
  contentDigest: string;         // "sha256-<64 lowercase hex>" over RFC 8785 JCS canonical JSON
}
```

- `validatePlacementAnalysis(definition, analysis, { definitionDigest })` is **synchronous** and does
  no hashing. The caller computes the digest with the exported async
  `computeDefinitionDigest(definition)` (Web Crypto `subtle.digest`, available in Node 18+ and the
  browser; no dependency, no network) and passes it in.
- Omitting `definitionDigest` is fail-closed (`DEFINITION_DIGEST_MISSING`), not a soft pass.
  A mismatch is `DEFINITION_DIGEST_MISMATCH`. This is what makes "the analysis was written against a
  different revision of the definition" a detectable error rather than a silent wrong answer.
- The M1 document must pass `validateWorkforceDefinition` first. `valid === false` yields
  `M1_DEFINITION_INVALID` and no further M2 evaluation.

**Back-compat rules (binding on Stage 8):**

1. `schemaVersion` of the M1 document stays `"1.0.0"`. `Task.executionType` stays the literal
   `"undecided"`. M2 never writes into the M1 document; a confirmed placement is recorded in the M2
   sidecar as `confirmedExecutionType`, and propagating it into an M1 `Task` is a later milestone
   with its own schema bump.
2. The `.` export of `@gadgets/workforce-compiler` must remain byte-identical. M2 is reachable only
   through the new `./m2` subpath, so an M1-only consumer cannot accidentally pull M2 rules.
3. The existing 12 M1 tests are not edited. A test asserting the M1 fixture's digest and validity is
   added under `m2/` so that any accidental M1 fixture edit fails loudly.
4. Loading the canonical M1 fixture with **no** analysis sidecar produces
   `decision: "undecided"`, `reasonCodes: ["NO_PLACEMENT_ANALYSIS"]`, `artifacts: []`, and leaves
   every M1 viewer surface (hierarchy, evidence, validation issues, draft approval card) unchanged.
5. A future rule change bumps `ruleSetVersion`. An analysis pinning an unrecognized `ruleSetVersion`
   is `undecided` with `RULE_SET_VERSION_UNKNOWN` — old documents fail closed instead of being
   silently re-scored under new rules.

## Canonical units

All comparisons run on integers produced by these fixed factors. They are part of the rule set and
change only with `ruleSetVersion`.

```text
PERIOD_FACTORS_PER_YEAR = { day: 365, week: 52, month: 12, quarter: 4, year: 1 }
```

- Time → **minutes per year** (integer). `period: "event"` means per occurrence: canonical value is
  `minutesPerEvent × frequencyPerYear`.
- Money → **currency minor unit per year** (integer; JPY minor unit is the yen itself). Every `Money`
  inside one `TaskAnalysis` must share one `currency`, else `UNIT_INCONSISTENT`.
- Counts → **events per year** (integer).
- A canonicalized value that is not a finite integer is `UNIT_NOT_CANONICALIZABLE`. Nothing is
  rounded into range.
- Band thresholds are written as integer cross-multiplications. `ratio ≤ 0.25` is implemented as
  `4 × numerator ≤ denominator`. Floating-point division is forbidden on the score path, and a lint
  rule plus a review checklist item enforce it.
- Dates are compared as UTC minute offsets from `analysis.generatedAt`; `YYYY-MM-DD` deadlines
  resolve to `T23:59:59Z` of that day.

## Business Analyst extension model

```ts
type ExecutionCandidate = "ai" | "existing_staff" | "hire" | "outsource";

/** Canonical emission order for every candidate-keyed array in every M2 output. */
const CANDIDATE_ORDER = ["ai", "existing_staff", "hire", "outsource"] as const;

type RubricScore = 0 | 1 | 2 | 3 | 4 | 5;

interface Rated {
  score: RubricScore;
  rubricId: string;        // e.g. "rubric.repeatability/1.0.0"
  rationale: string;
  evidence: EvidenceRef;   // reused unchanged from M1
}

interface WorkforcePlacementAnalysis {
  schemaVersion: "2.0.0";
  analysisId: string;                 // "wpa-" prefixed, lower-kebab-case
  analysisVersion: string;            // semver of this analyst document
  ruleSetVersion: "wc-m2-rules/1.0.0";
  generatedAt: string;                // RFC 3339; the ONLY clock M2 reads
  evaluationHorizonYears: 1 | 2 | 3;
  definitionRef: DefinitionRef;
  provenance: DocumentProvenance;     // reused unchanged from M1
  scopeTaskIds: string[];             // non-empty; each must exist in the definition
  taskAnalyses: TaskAnalysis[];       // exactly one per scopeTaskIds entry
  humanSelections: HumanSelection[];  // may be empty
}

interface TaskAnalysis {
  taskId: string;                     // must be in scopeTaskIds
  workCharacteristics: WorkCharacteristics;
  operatingConstraints: OperatingConstraints;
  demand: Demand;
  currentState: CurrentState;
  optionEstimates: OptionEstimate[];  // exactly 4, one per candidate, canonical order
  counterEvidence: CounterEvidence[]; // may be empty
}

interface WorkCharacteristics {
  repeatability: Rated;      // higher = more repeatable
  digitality: Rated;         // higher = input and output fully digital
  exceptionRate: Rated;      // higher = MORE exceptions
  judgmentEmpathy: Rated;    // higher = MORE human judgment or empathy required
  specifiability: Rated;     // higher = more completely specifiable in advance
  procedureSteps: string[];  // non-empty; ordered
  knownExceptions: string[]; // may be empty
}

interface OperatingConstraints {
  deadline: string | null;                          // YYYY-MM-DD
  requiredAvailability: "business_hours" | "extended_hours" | "24x7";
  dataSensitivity: "public" | "internal" | "confidential" | "restricted";
  requiredAuthority: Authority;                     // reused from M1
  mustInternal: boolean;
  forbiddenExecutionTypes: ExecutionCandidate[];    // may be empty
  legalConstraints: string[];
  contractConstraints: string[];
  securityConstraints: string[];
  evidence: EvidenceRef[];
}

interface Demand {
  frequency: Quantity;        // reused from M1
  volume: Quantity;
  variabilityPct: Quantity;   // relative swing around the mean, unit "percent"
  peakVolume: Quantity;
  slaTurnaround: Quantity;    // unit "minute"; period "event"
}

interface CurrentState {
  ownerRoleId: string | null;      // "role-" or "profile-" prefix ONLY; never a person's name
  capacity: Quantity;              // unit "minute"
  skillProfile: AttainedSkill[];
  timeSpent: Quantity;             // unit "minute"
  costPerPeriod: Money;            // scoring baseline; null amount => candidate-independent unknown
  qualityRecord: Rated;            // observed quality of the current arrangement
  evidence: EvidenceRef[];
}

interface AttainedSkill {
  skillId: string;                 // must exist in the M1 definition
  attainedLevel: 1 | 2 | 3 | 4 | 5 | null;
  evidence: EvidenceRef;
}

interface CostEstimate {
  low: Money;
  base: Money;   // used for scoring
  high: Money;   // low <= base <= high after canonicalization, else COST_RANGE_INVERTED
}

interface OptionEstimate {
  candidate: ExecutionCandidate;
  setupTime: Quantity;             // unit "minute"
  setupCost: CostEstimate;
  runTime: Quantity;               // unit "minute", period "event"
  runCost: CostEstimate;
  availableCapacity: Quantity;     // unit "minute"
  toolAvailability: "available" | "obtainable_in_scope" | "unavailable" | "unknown";
  contextAvailability: "available" | "obtainable_in_scope" | "unavailable" | "unknown";
  authorityGrantable: boolean | null;
  attainableSkills: AttainedSkill[];
  learningTime: Quantity;          // unit "minute"
  expectedQuality: Rated;
  reversibility: Rated;
  learningValue: Rated;
  confidence: Rated;
  evidence: EvidenceRef[];
}

interface CounterEvidence {
  id: string;
  againstCandidate: ExecutionCandidate;
  claim: string;
  weightHint: "minor" | "material" | "blocking";
  evidence: EvidenceRef;
}

interface HumanSelection {
  taskId: string;
  selectedExecutionType: ExecutionCandidate;
  selectedAt: string;              // RFC 3339
  rationale: string;
  approval: M2ApprovalGate;        // must be a placement_commit card
}
```

Explicitly **out of scope for M2** and absent from the schema: real candidate identities, contact
details, résumés, salary or contract terms, ad-account identifiers, credentials, and any value read
from an external API. There is no field to put them in, which is the enforcement.

## Rubric definitions (0–5)

Every `Rated.score` is an integer with these anchors. `rubricId` pins the anchor set; an unknown
`rubricId` is `RULE_SET_VERSION_UNKNOWN`. 0 and 5 are real, reachable values, not reserved.

### `rubric.repeatability/1.0.0` — higher = more repeatable

| Score | Anchor |
| --- | --- |
| 0 | Every occurrence is materially different; no reusable procedure exists |
| 1 | A loose pattern exists but each run is re-planned from scratch |
| 2 | A written procedure covers the common path; frequent improvisation |
| 3 | A stable procedure covers most runs; variation is parameter-level |
| 4 | Identical procedure each run; variation is input data only |
| 5 | Byte-level identical steps; a checklist fully determines the run |

### `rubric.digitality/1.0.0` — higher = more fully digital

| Score | Anchor |
| --- | --- |
| 0 | Inputs and outputs are physical or in-person only |
| 1 | Mostly offline; digital artifacts are incidental |
| 2 | Mixed; a required input or output is non-digital |
| 3 | Digital, but a manual transcription or human hand-off step remains |
| 4 | Fully digital end to end; some tools lack a programmatic interface |
| 5 | Fully digital and machine-readable at every input and output |

### `rubric.exceptionRate/1.0.0` — higher = MORE exceptions

| Score | Anchor | Indicative rate |
| --- | --- | --- |
| 0 | Essentially exception-free | ≤ 1% |
| 1 | Rare exceptions with a documented path | ≤ 5% |
| 2 | Occasional exceptions, mostly documented | ≤ 10% |
| 3 | Regular exceptions; some undocumented | ≤ 20% |
| 4 | Exceptions are a normal part of the work | ≤ 40% |
| 5 | The work is predominantly exception handling | > 40% |

### `rubric.judgmentEmpathy/1.0.0` — higher = MORE human judgment or empathy required

| Score | Anchor |
| --- | --- |
| 0 | Purely mechanical; no interpretation |
| 1 | Rule-bound with a documented decision table |
| 2 | Bounded interpretation within a stated policy |
| 3 | Trade-offs across stated goals; explainable after the fact |
| 4 | Ambiguous trade-offs, stakeholder context, or emotional stakes |
| 5 | High-stakes relational or ethical judgment; accountability is personal |

### `rubric.specifiability/1.0.0` — higher = more completely specifiable in advance

| Score | Anchor |
| --- | --- |
| 0 | Acceptance cannot be stated before the work is done |
| 1 | Only the goal is statable; acceptance emerges during the work |
| 2 | Acceptance is statable in prose; disagreement is common |
| 3 | Acceptance is statable with examples; most disputes resolvable |
| 4 | Acceptance is a checkable checklist |
| 5 | Acceptance is machine-checkable |

### `rubric.expectedQuality/1.0.0` — higher = better expected output quality by this candidate

| Score | Anchor |
| --- | --- |
| 0 | Cannot meet the task's stated quality standard |
| 1 | Meets it rarely; heavy rework expected |
| 2 | Meets it about half the time |
| 3 | Meets it typically; routine review catches the rest |
| 4 | Meets it consistently; spot review sufficient |
| 5 | Meets or exceeds it consistently and verifiably |

### `rubric.reversibility/1.0.0` — higher = easier to undo

| Score | Anchor |
| --- | --- |
| 0 | Effectively irreversible within the horizon |
| 1 | Reversible only at major cost or contractual penalty |
| 2 | Reversible with significant notice and rework |
| 3 | Reversible within one period at moderate cost |
| 4 | Reversible quickly with minor cost |
| 5 | Reversible immediately at negligible cost |

### `rubric.learningValue/1.0.0` — higher = more capability retained in-house

| Score | Anchor |
| --- | --- |
| 0 | No capability retained; knowledge leaves with the arrangement |
| 1 | Only documentation retained |
| 2 | Procedure retained; no one internal can run it |
| 3 | One internal person can run it after hand-off |
| 4 | The team can run and improve it |
| 5 | The capability becomes reusable across other tasks |

### `rubric.confidence/1.0.0` — higher = better-grounded estimate

| Score | Anchor |
| --- | --- |
| 0 | Guess with no basis |
| 1 | Analogy to an unrelated case |
| 2 | Analogy to a similar case |
| 3 | Vendor or internal quote without a trial |
| 4 | Small trial or a documented comparable |
| 5 | Measured on this exact task |

`confidence` does not enter the score. It drives the Approval Card and is reported per estimate so a
Human can see that a high score rests on a weak estimate.

## Feasibility gate

Every rule below is evaluated for all four candidates. Nothing short-circuits. The result is
`{ candidate, verdict, reasonCodes[] }` with `reasonCodes` sorted lexicographically and the array
emitted in `CANDIDATE_ORDER`.

Verdict = `ineligible` if any BLOCK rule fired; else `unknown` if any UNKNOWN rule fired; else
`eligible`.

### BLOCK rules

| Reason code | Fires when | Applies to |
| --- | --- | --- |
| `FG_FORBIDDEN_BY_CONSTRAINT` | candidate ∈ `forbiddenExecutionTypes` | any |
| `FG_MUST_INTERNAL` | `mustInternal === true` | `outsource` |
| `FG_TOOL_UNAVAILABLE` | `toolAvailability === "unavailable"` | any |
| `FG_CONTEXT_UNAVAILABLE` | `contextAvailability === "unavailable"` | any |
| `FG_AUTHORITY_UNAVAILABLE` | `requiredAuthority === "execute_after_approval"` and `authorityGrantable === false` | any |
| `FG_DATA_SENSITIVITY_EXCEEDED` | `dataSensitivity === "restricted"` | `ai`, `outsource` |
| `FG_DEADLINE_UNREACHABLE` | `deadline !== null` and `setupTime + learningTime > slackMinutes` | any |
| `FG_CAPACITY_INSUFFICIENT` | `availableCapacityPerYear < runTimePerYear` | any |
| `FG_SKILL_GAP_UNCLOSABLE` | `maxSkillGap ≥ 3` and (`deadline !== null` and `learningTime > slackMinutes`) | `existing_staff`, `hire` |
| `FG_LEGAL_CONSTRAINT` | a `legalConstraints`/`contractConstraints`/`securityConstraints` entry names this candidate as prohibited | any |
| `FG_AVAILABILITY_UNMET` | `requiredAvailability === "24x7"` and the candidate's `availableCapacityPerYear` is below the 24x7 coverage minimum in the rule set | `existing_staff`, `hire` |

### UNKNOWN rules

| Reason code | Fires when |
| --- | --- |
| `FG_INPUT_MISSING` | any candidate-scoped score input is `null` |
| `FG_EVIDENCE_UNVERIFIED` | any candidate-scoped score input carries `evidence.status === "unverified"` |
| `FG_TOOL_UNKNOWN` | `toolAvailability === "unknown"` |
| `FG_CONTEXT_UNKNOWN` | `contextAvailability === "unknown"` |
| `FG_AUTHORITY_UNKNOWN` | `requiredAuthority === "execute_after_approval"` and `authorityGrantable === null` |
| `FG_SKILL_LEVEL_UNKNOWN` | a required skill has `attainedLevel === null` for this candidate |

`assumed` evidence is acceptable and is surfaced, not blocked — synthetic documents cannot claim
`observed` (inherited M1 rule), so a blanket ban on non-`observed` evidence would make every
synthetic fixture `undecided` and the whole comparison untestable.

**Candidate-scoped score inputs** (the closed list the two UNKNOWN rules above range over):
`setupTime`, `setupCost.base`, `runTime`, `runCost.base`, `availableCapacity`, `learningTime`,
`expectedQuality`, `reversibility`, `learningValue`, and the `attainedLevel` of every skill in
`task.requiredSkills`.

**Gate/score invariant:** `verdict === "eligible"` implies every candidate-scoped score input is
non-null and not `unverified`. Stage 8 asserts this invariant in code; scoring may therefore read
inputs directly and must never contain a null-coalescing default.

## Scoring

Only `eligible` candidates are scored. Weights are fixed and version-pinned:

| Component | Weight | Points per sub-score step |
| --- | --- | --- |
| `capability` | 35 | 7 |
| `capacityTime` | 20 | 4 |
| `qualityRisk` | 20 | 4 |
| `totalCost` | 15 | 3 |
| `reversibilityLearning` | 10 | 2 |

`componentPoints = (weight / 5) × subScore`. Every weight is divisible by 5, so this is exact integer
multiplication — no rounding rule, no floating point, no accumulation error. `totalScore` is the
integer sum, range 0–100.

### `capability` sub-score

```text
capabilitySub = clamp(0, 5, skillFitBase + shapeAdjust)
```

`maxSkillGap = max over task.requiredSkills of max(0, requiredLevel − attainedLevel)`.

| `maxSkillGap` | 0 | 1 | 2 | 3 | ≥4 |
| --- | --- | --- | --- | --- | --- |
| `skillFitBase` | 5 | 4 | 2 | 1 | 0 |

`shapeAdjust` (0 for `existing_staff` and `hire`; a human's capability is skill fit, not task shape):

- `ai`: `shape = repeatability + digitality + specifiability + (5 − exceptionRate) + (5 − judgmentEmpathy)`, range 0–25.
  `shape ≥ 20 → +1`; `13–19 → 0`; `7–12 → −1`; `≤6 → −2`.
- `outsource`: `shape = specifiability + repeatability + (5 − judgmentEmpathy)`, range 0–15.
  `shape ≥ 12 → +1`; `7–11 → 0`; `4–6 → −1`; `≤3 → −2`.

### `capacityTime` sub-score

```text
capacityTimeSub = min(readinessPoints, marginPoints)
```

Taking the minimum is deliberate: a candidate that is ready fast but has no capacity, or has ample
capacity but cannot be ready by the deadline, is not a good fit on this axis.

`readinessPoints` (`deadline === null` → 5), with `ready = setupTime + learningTime`, `slack` in minutes:

| Condition (integer cross-multiplied) | Points |
| --- | --- |
| `4 × ready ≤ slack` | 5 |
| `2 × ready ≤ slack` | 4 |
| `4 × ready ≤ 3 × slack` | 3 |
| `ready ≤ slack` | 2 |
| otherwise | 0 |

`marginPoints`, with `required = runTimePerYear`, `margin = availableCapacityPerYear − required`:

| Condition | Points |
| --- | --- |
| `margin ≥ required` | 5 |
| `2 × margin ≥ required` | 4 |
| `4 × margin ≥ required` | 3 |
| `10 × margin ≥ required` | 2 |
| `margin ≥ 0` | 1 |
| otherwise | 0 |

`required === 0` is `UNIT_NOT_CANONICALIZABLE` (a task with zero run time has no demand to place).

### `qualityRisk` sub-score

```text
qualityRiskSub = clamp(0, 5, expectedQuality.score − riskPenalty − sensitivityPenalty)
```

- `riskPenalty`: `task.risk.level` `critical` → 2, `high` → 1, `medium` → 0, `low` → 0.
- `sensitivityPenalty`: 1 when `dataSensitivity === "confidential"` and candidate ∈ {`ai`, `outsource`}, else 0.
  (`restricted` is already a BLOCK for those two.)

### `totalCost` sub-score

Horizon totals in canonical minor units, `Y = evaluationHorizonYears`:

```text
candidateCost = setupCost.base + (runCostPerYear × Y)
baselineCost  = currentState.costPerPeriodPerYear × Y
```

| Condition (integer cross-multiplied) | Points |
| --- | --- |
| `2 × candidateCost ≤ baselineCost` | 5 |
| `4 × candidateCost ≤ 3 × baselineCost` | 4 |
| `candidateCost ≤ baselineCost` | 3 |
| `2 × candidateCost ≤ 3 × baselineCost` | 2 |
| `candidateCost ≤ 2 × baselineCost` | 1 |
| otherwise | 0 |

The baseline is the task's own current cost, not the cheapest rival. Cost points are therefore
absolute and stable: adding or removing a candidate cannot change another candidate's cost score.
`baselineCost === 0` or a null `costPerPeriod.amount` is task-level fail-closed
(`MISSING_COST_BASELINE`), because a ratio against an absent baseline is not a comparison.

### `reversibilityLearning` sub-score

```text
reversibilityLearningSub = floor((reversibility.score + learningValue.score) / 2)
```

### Ranking

`ranking` is sorted by `totalScore` descending, then by `CANDIDATE_ORDER` index ascending. This is a
total order, so the array is stable and byte-equivalent across runs — but position 1 in a tie is
**not** a recommendation. The decision rule below is what distinguishes them.

## Decision, sensitivity, and fail-closed policy

```ts
type Decision = "recommended" | "human_choice" | "undecided";
const MIN_RECOMMENDATION_MARGIN = 5;
```

Evaluated in order:

1. Any fail-closed condition → `undecided`.
2. `eligibleCount === 0` → `undecided` with `NO_ELIGIBLE_CANDIDATE` (and `ALL_CANDIDATES_UNKNOWN`
   when all four are `unknown`).
3. `eligibleCount === 1` and no candidate is `unknown` → `recommended`.
4. `eligibleCount === 1` and at least one candidate is `unknown` → `human_choice` with
   `SOLE_ELIGIBLE_WITH_UNKNOWN_RIVALS`. One survivor is not a comparison when the rivals were never
   evaluated.
5. `top1.totalScore − top2.totalScore ≥ MIN_RECOMMENDATION_MARGIN` → `recommended`.
6. Otherwise → `human_choice` with `MARGIN_BELOW_THRESHOLD` (exact ties included). No automatic
   tie-break exists.

### Fail-closed conditions

| Code | Condition |
| --- | --- |
| `M1_DEFINITION_INVALID` | the M1 document fails `validateWorkforceDefinition` |
| `DEFINITION_DIGEST_MISSING` | caller supplied no digest |
| `DEFINITION_DIGEST_MISMATCH` | digest differs from `definitionRef.contentDigest` |
| `ANALYSIS_SCHEMA_INVALID` | the analysis fails its JSON Schema |
| `RULE_SET_VERSION_UNKNOWN` | unrecognized `ruleSetVersion` or `rubricId` |
| `CRITICAL_EVIDENCE_UNVERIFIED` | a **task-level** input (`demand`, `currentState`, `operatingConstraints`) is `unverified` |
| `MISSING_COST_BASELINE` | `currentState.costPerPeriod.amount` is null or canonicalizes to 0 |
| `NO_ELIGIBLE_CANDIDATE` | zero `eligible` candidates |
| `ALL_CANDIDATES_UNKNOWN` | all four `unknown` |
| `UNIT_INCONSISTENT` | mixed currency, or a period/unit pair the factors do not cover |
| `UNIT_NOT_CANONICALIZABLE` | a canonicalized value is not a finite integer, or `runTimePerYear === 0` |
| `VALUE_OUT_OF_RANGE` | a rubric score outside 0–5, a negative time/cost, or a total outside 0–100 |
| `COST_RANGE_INVERTED` | not `low ≤ base ≤ high` after canonicalization |
| `FORBIDDEN_CANDIDATE_RANKED_FIRST` | a candidate in `forbiddenExecutionTypes` holds rank 1 |
| `RISK_APPROVAL_INCONSISTENT` | `requiredAuthority === "execute_after_approval"` but the selection's approval card is absent or not `placement_commit` |
| `NONDETERMINISTIC_RESULT` | the self-check re-run produces a different canonical JSON string |
| `NO_PLACEMENT_ANALYSIS` | an M1 document was supplied with no sidecar |
| `TASK_OUT_OF_SCOPE` | a `TaskAnalysis` references a task not in `scopeTaskIds` |
| `TASK_ANALYSIS_DUPLICATE` | two `TaskAnalysis` entries share a `taskId` |
| `OWNER_NOT_SYNTHETIC_ROLE` | `ownerRoleId` does not match `^(role|profile)-[a-z0-9-]+$` |

`undecided` produces **zero artifacts** and a `requiredClarifications` list — the minimum set of
questions whose answers could change the outcome, deduplicated by `targetPath` and sorted by it:

```ts
interface Clarification {
  id: string;
  targetPath: string;          // RFC 6901 JSON Pointer into the analysis
  question: string;
  whyBlocking: string;         // which fail-closed code it clears
  acceptableEvidence: string[];
}
```

The compiler also runs a **self-check**: it evaluates twice from the same canonicalized input and
compares the JCS-canonical JSON of both results. A difference is `NONDETERMINISTIC_RESULT` and
fail-closed, so a determinism regression surfaces as a refusal rather than as a plausible answer.

### Sensitivity

Two deterministic, bounded, offline perturbation families:

1. **One-step rubric perturbation.** For every rubric input that feeds the score, recompute with
   `score ± 1` (clamped to 0–5), one field at a time, all other inputs held. Report an entry when the
   rank-1 candidate changes or the order of the top two swaps.
2. **Cost-range perturbation.** Recompute once with every candidate at `costEstimate.low` and once at
   `costEstimate.high`. Report when rank 1 differs from the `base` run.

```ts
interface SensitivityEntry {
  targetPath: string;          // JSON Pointer, primary sort key
  perturbation: "minus_one" | "plus_one" | "cost_low" | "cost_high";
  effect: "rank1_changed" | "top2_swapped";
  fromCandidate: ExecutionCandidate;
  toCandidate: ExecutionCandidate;
}
```

Additionally, every band comparison records `nearBoundary: true` when the value sits within 10% of the
threshold it was tested against (again by integer cross-multiplication). A recommendation resting on a
near-boundary input is visibly fragile rather than silently confident.

## Result contract

```ts
interface PlacementResult {
  schemaVersion: "2.0.0";
  ruleSetVersion: "wc-m2-rules/1.0.0";
  analysisId: string;
  generatedAt: string;                  // copied from the analysis, never Date.now()
  definitionRef: DefinitionRef;
  valid: boolean;
  issues: ValidationIssue[];            // M1 shape; sorted by path then code
  tasks: TaskPlacementResult[];         // sorted by taskId
}

interface TaskPlacementResult {
  taskId: string;
  decision: Decision;
  decisionReasonCodes: string[];        // sorted
  candidates: CandidateResult[];        // CANDIDATE_ORDER
  ranking: RankEntry[];                 // score desc, then CANDIDATE_ORDER
  supportingEvidence: EvidenceRef[];    // for the rank-1 candidate; sorted by evidence id
  counterEvidence: CounterEvidence[];   // sorted by id
  assumptions: EvidenceRef[];           // every input with status "assumed"; sorted by id
  missingEvidence: Clarification[];     // sorted by targetPath
  sensitivity: SensitivityEntry[];      // sorted by targetPath then perturbation
  requiredClarifications: Clarification[];
  confirmedExecutionType: ExecutionCandidate | null;   // set only via an approved HumanSelection
  approval: M2ApprovalGate | null;
  artifacts: DraftArtifact[];           // sorted by artifactType then id
}

interface CandidateResult {
  candidate: ExecutionCandidate;
  verdict: "eligible" | "ineligible" | "unknown";
  reasonCodes: string[];                // sorted
  totalScore: number | null;            // null unless eligible
  breakdown: ComponentScore[] | null;   // fixed component order
}

interface ComponentScore {
  component: "capability" | "capacityTime" | "qualityRisk" | "totalCost" | "reversibilityLearning";
  subScore: RubricScore;
  weight: number;
  points: number;
  inputPaths: string[];                 // JSON Pointers into the analysis; sorted
  nearBoundary: boolean;
}
```

`ValidationIssue` is reused unchanged from M1 (`code`, `path`, `message`, `severity: "error"`,
`relatedIds`) so the Gadget renders M1 and M2 issues with one component.

## Human Approval boundary

Read-only and approval-free: ingesting analyst input, validation, gating, scoring, ranking,
sensitivity, and generating draft artifacts locally.

Confirming `executionType` requires an approval card:

```ts
type M2ApprovalActionType =
  | "none"
  | "placement_commit"        // record executionType in the SSOT — the ONLY M2 action type
  | "job_posting_publish"
  | "candidate_contact"
  | "contract_award"
  | "hiring_decision"
  | "budget_commit"
  | "account_connect"
  | "agent_external_write"
  | "real_data_ingest";

interface M2ApprovalGate {
  requiresHumanApproval: true;
  state: "draft" | "pending" | "approved" | "rejected";   // "executed" is rejected in M2
  actionType: M2ApprovalActionType;
  target: string;                       // the task id whose executionType changes
  candidate: ExecutionCandidate;
  totalScore: number;
  runnerUp: ExecutionCandidate | null;
  margin: number | null;
  topSupportingEvidence: EvidenceRef[]; // at most 3, sorted by evidence id
  topCounterEvidence: CounterEvidence[];// at most 3, sorted by id
  costRange: { low: Money; base: Money; high: Money };
  riskLevel: RiskLevel;
  reversibility: RubricScore;
  lowestConfidence: RubricScore;        // weakest estimate behind this recommendation
  proposedDiff: string;                 // what changes in the SSOT
  expectedResult: string;
  downside: string;
  rollback: string;
  idempotencyKey: string;
  scopeStatement: string;               // fixed text; see below
}
```

`M2ApprovalActionType` is a separate union in `src/m2/types.ts`. M1's `ApprovalActionType` is not
extended, so the M1 type surface stays byte-identical.

`scopeStatement` is fixed, non-editable text: *"This approval records a placement decision only. It
does not authorize publishing a job post, contacting a candidate, awarding a contract, hiring,
committing budget, connecting an account, granting an AI agent external write access, or ingesting
real data. Each of those is a separate approval."*

Placement approval is never reused as execution approval. `state: "executed"` is rejected in M2
because M2 has no executor — the same rule M1 applies.

## Draft artifacts

Generated only when the analysis is valid, `decision !== "undecided"`, and the artifact's trigger
below is met. Every artifact is `status: "draft"`, `deliveryChannel: "local_only"`, carries
`taskIds`, `skillIds`, `evidenceRefs`, `ruleSetVersion`, and `generatedAt` copied from the analysis,
and lists every unresolved point in `unresolved[]` rather than filling it with an assertion or an
empty string.

| Artifact | Trigger | `artifactType` |
| --- | --- | --- |
| Skill Gap | every `eligible` candidate, always | `skill_gap` |
| AI Agent Spec | `confirmedExecutionType === "ai"` | `ai_agent_spec` |
| JD | `confirmedExecutionType ∈ {"existing_staff", "hire"}` | `job_description` |
| Outsourcing SOW | `confirmedExecutionType === "outsource"` | `outsourcing_sow` |

With no confirmed selection, only Skill Gap artifacts are produced. A JD generated for
`existing_staff` sets `jdMode: "role_assignment_draft"`; for `hire` it sets `jdMode: "hiring_draft"`.

```ts
interface DraftArtifact {
  id: string;
  artifactType: "skill_gap" | "ai_agent_spec" | "job_description" | "outsourcing_sow";
  status: "draft";
  deliveryChannel: "local_only";
  taskIds: string[];
  skillIds: string[];
  candidate: ExecutionCandidate;
  ruleSetVersion: string;
  generatedAt: string;
  evidenceRefs: EvidenceRef[];
  unresolved: Clarification[];
  body: SkillGapBody | AiAgentSpecBody | JobDescriptionBody | OutsourcingSowBody;
}

interface SkillGapBody {
  roleRef: string | null;                  // role-/profile- id, or null for role-level gap only
  granularity: "role_level" | "profile_level";
  gaps: Array<{
    skillId: string;
    requiredLevel: 1 | 2 | 3 | 4 | 5;
    currentLevel: 1 | 2 | 3 | 4 | 5 | null;
    delta: number;
    severity: "none" | "minor" | "material" | "blocking";
    learningTimeRange: { low: Quantity; base: Quantity; high: Quantity };
    learningTimeFormula: string;
    verificationMethod: string;
    evidence: EvidenceRef;
  }>;
  readiness: "ready" | "conditional" | "not_ready";
}

interface AiAgentSpecBody {
  role: string;
  purpose: string;
  taskIds: string[];
  inputs: string[];
  outputs: string[];
  skillIds: string[];
  contextRefs: string[];
  allowedTools: string[];
  forbiddenTools: string[];
  authority: Authority;
  approvalGates: M2ApprovalActionType[];
  qualityStandard: AcceptanceCriterion[];
  kpis: Metric[];
  failureModes: string[];
  stopConditions: string[];
  escalationPath: string;
}

interface JobDescriptionBody {
  jdMode: "role_assignment_draft" | "hiring_draft";
  purpose: string;
  responsibilities: string[];
  taskIds: string[];
  requiredSkills: RequiredSkill[];
  preferredSkills: RequiredSkill[];
  authority: Authority;
  approvalGates: M2ApprovalActionType[];
  kpis: Metric[];
  qualityStandard: AcceptanceCriterion[];
  capacity: Quantity;
  constraints: string[];
  skillGapArtifactId: string;
}

interface OutsourcingSowBody {
  scope: string;
  taskIds: string[];
  deliverables: string[];
  sla: Metric[];
  kpis: Metric[];
  acceptanceCriteria: AcceptanceCriterion[];
  requiredEvidence: string[];
  clientDependencies: string[];
  dataBoundary: string;
  accessBoundary: string;
  approvalGates: M2ApprovalActionType[];
  changeControl: string;
  rollback: string;
  terminationConditions: string;
  costEstimate: CostEstimate;
}
```

**Artifact validator invariants** (semantic, beyond JSON Schema):

- `ARTIFACT_WITHOUT_DECISION` — an artifact exists while `decision === "undecided"`.
- `ARTIFACT_CANDIDATE_MISMATCH` — the artifact's `candidate` is not the trigger candidate.
- `ARTIFACT_REFERENCE_MISSING` — a `taskId` or `skillId` absent from the M1 definition.
- `ARTIFACT_EVIDENCE_MISSING` — a stated fact with no `EvidenceRef`.
- `ARTIFACT_EMPTY_REQUIRED_FIELD` — a required string is empty or whitespace; unknown facts belong in
  `unresolved`, never as `""` and never as an invented value.
- `ARTIFACT_APPROVAL_MISSING` — an `ai_agent_spec` with an external-write tool but no matching
  `approvalGates` entry.
- `ARTIFACT_CLOCK_DRIFT` — `generatedAt` differs from `analysis.generatedAt`.
- `SKILL_GAP_READINESS_INCONSISTENT` — `readiness: "ready"` while a gap has severity `blocking`.

Deferred to a later Stage, per the accepted contract: **求人票** (job posting; needs compensation,
employment terms, and a publication approval) and **Onboarding** (needs a confirmed placement plus
Skill Gap acceptance).

## Gadget contract

The M2 Gadget is a read-only comparison view. It reuses the M1 viewer for hierarchy and evidence and
adds one placement screen per task. It re-implements no rule; it renders `PlacementResult`.

Single-screen information structure, top to bottom:

1. **Header** — definition title, task id and name, `decision` badge, `analysisVersion`,
   `ruleSetVersion`, short digest, and `generatedAt`.
2. **Candidate matrix** — four fixed columns in `CANDIDATE_ORDER`. Each column shows the verdict
   chip, every reason code with its plain-language gloss, `totalScore`, and the five component bars
   labelled `points / weight`. Ineligible and unknown columns stay visible with their scores struck
   out — the excluded candidates and *why* are the point of the screen.
3. **Breakdown drawer** — per candidate: each component's `subScore`, weight, points, the JSON
   Pointer of every input that fed it, that input's evidence status, and the `nearBoundary` flag.
4. **Evidence panel** — counts of `observed` / `assumed` / `unverified` (never collapsed into one
   "confirmed"), supporting evidence for rank 1, counter-evidence, assumptions, missing evidence.
5. **Sensitivity panel** — every `SensitivityEntry` as "change *this* by one step and rank 1 becomes
   *that*", each linking to the input in the breakdown drawer.
6. **Decision and approval** — for `recommended` the margin over the runner-up; for `human_choice`
   the reason no recommendation was made; for `undecided` the `requiredClarifications` list and
   nothing else. The approval card renders as a non-executing preview labelled `draft`, with the
   fixed `scopeStatement` always visible.
7. **Draft artifact preview** — tabs per generated artifact, read-only, `unresolved` rendered inline
   as open questions rather than hidden. Export writes a local file only.
8. **Validation issues** — code plus JSON Pointer, M1 and M2 issues in one list.

Constraints: no fetch path, no secret, no Gatekeeper / AI-model / Agent-Spawner / ad-account binding,
no action endpoint. Evidence status and verdicts are never encoded by color alone. Agent prose is
displayed in a clearly separate region and can never mark a result acceptable — `valid` and
`decision` come from the validator only.

## Core Skills application

- **evidence-first-research** — every fact carries an `EvidenceRef`; `unverified` critical input is
  fail-closed; `assumptions` and `missingEvidence` are first-class output fields, not prose.
- **goal-backward-planning** — the gate runs from the task's deadline, capacity, and required
  authority backwards to candidate feasibility; `readinessPoints` is literally slack-to-deadline.
- **approval-safe-execution** — placement commit is one narrow approval with a fixed
  non-transferable `scopeStatement`; every downstream action is separately gated; `executed` is
  rejected because M2 has no executor.
- **quality-gate** — `合格` only when every required case in the matrix below passes; `条件付き合格`
  only for explicitly non-M2 environment checks; `未合格` for any contract failure. A document, a UI,
  or a test *name* is not evidence; the observable validator result is.

## Security and privacy

- No API key, paid API, metered route, paid fallback, external send, credential, production deploy,
  or destructive change. Zero network calls on every path, asserted by test.
- No real PII: no candidate names, contact details, résumés, salaries, or contract terms. The schema
  provides no field for them, and `ownerRoleId` is pattern-constrained to `role-` / `profile-` ids.
- Synthetic provenance cannot claim `observed` evidence (inherited M1 rule).
- `dataSensitivity: "restricted"` blocks `ai` and `outsource` at the gate; `confidential` penalizes
  them. Data boundaries are explicit fields in the SOW body, not prose.
- Fixtures are scanned by test for credential-shaped strings and for e-mail/phone patterns.

## Acceptance and test matrix

Stage 8 is accepted only when one local command
(`pnpm --filter @gadgets/workforce-compiler test:run`) runs all of the following deterministically.

### Fixtures

| Id | Fixture | Expected |
| --- | --- | --- |
| F1 | `m2-baseline-clear-winner` | 4 eligible, rank-1 margin ≥ 5 → `recommended` |
| F2 | `m2-must-internal` | `outsource` ineligible via `FG_MUST_INTERNAL` |
| F3 | `m2-tool-context-missing` | `ai` and `outsource` ineligible; others scored |
| F4 | `m2-deadline-capacity` | `hire` ineligible (`FG_DEADLINE_UNREACHABLE`), `existing_staff` ineligible (`FG_CAPACITY_INSUFFICIENT`) |
| F5 | `m2-tie` | two eligible at equal totals → `human_choice`, `MARGIN_BELOW_THRESHOLD` |
| F6 | `m2-near-margin` | margin 4 → `human_choice`; margin 5 → `recommended` |
| F7 | `m2-critical-evidence-unverified` | `undecided`, `CRITICAL_EVIDENCE_UNVERIFIED` |
| F8 | `m2-forbidden-top` | forbidden candidate at rank 1 → `undecided` |
| F9 | `m2-unit-mismatch` | mixed currency → `undecided`, `UNIT_INCONSISTENT` |
| F10 | `m2-all-unknown` | 4 unknown → `undecided`, `ALL_CANDIDATES_UNKNOWN` |
| F11 | `m2-sole-eligible-unknown-rivals` | `human_choice`, `SOLE_ELIGIBLE_WITH_UNKNOWN_RIVALS` |
| F12 | `m2-cost-baseline-missing` | `undecided`, `MISSING_COST_BASELINE` |
| F13–F16 | `m2-selected-{ai,existing-staff,hire,outsource}` | one artifact of the matching type plus Skill Gap for every eligible candidate |
| F17 | `m2-sensitivity-boundary` | a one-step change flips rank 1; `nearBoundary` set |
| F18 | M1 canonical fixture, **no sidecar** | `undecided`, `NO_PLACEMENT_ANALYSIS`, zero artifacts, M1 result unchanged |

Every fixture is synthetic, uses `role-`/`profile-` ids, and contains no real business data.

### Required cases

1. **M1 regression** — the 12 M1 tests pass unedited; the M1 fixture's digest matches a pinned
   constant; `import * as m1 from "@gadgets/workforce-compiler"` exposes exactly the M1 export list.
2. **Back-compat** — F18 leaves the M1 validation result deeply equal to the M1-only run.
3. **Four-candidate coverage** — every fixture emits exactly four `CandidateResult` entries in
   `CANDIDATE_ORDER`, each with at least one reason code when not `eligible`.
4. **Gate totality** — a fixture triggering three BLOCK rules on one candidate reports all three
   codes, sorted; no rule is skipped by an earlier match.
5. **Gate/score invariant** — for every `eligible` candidate in every fixture, all candidate-scoped
   score inputs are non-null and not `unverified` (asserted directly, not inferred).
6. **Score arithmetic** — component points equal `(weight / 5) × subScore` for all 6 sub-scores × 5
   components; totals are integers in 0–100; a property test over randomized valid inputs asserts no
   non-integer ever appears in a breakdown.
7. **Determinism** — 100 evaluations of F1 are deeply equal *and* produce an identical JCS-canonical
   JSON string; the self-check never reports `NONDETERMINISTIC_RESULT` on a valid fixture.
8. **Single-input change** — mutating exactly one input in F1 changes only the components that read
   it, its `inputPaths`, and the sensitivity entries — every other breakdown value is byte-identical.
9. **Fail-closed** — each of F7–F10 and F12 yields `artifacts: []`, a non-empty
   `requiredClarifications`, zero network calls, and no credential or PII in the output.
10. **Artifact triggers** — F13–F16 each generate exactly the expected artifact set; no selection
    yields Skill Gap only; every artifact invariant above has a rejecting mutation test.
11. **Approval invariants** — a `placement_commit` card missing any required field is rejected;
    `state: "executed"` is rejected; `confirmedExecutionType` set without an approved card is
    `RISK_APPROVAL_INCONSISTENT`; the fixed `scopeStatement` is asserted verbatim.
12. **Sensitivity** — F17's flip is reported with the correct `targetPath`, `perturbation`, and
    `from`/`to`; a cost `low`/`high` flip is reported for a fixture whose ranking is cost-sensitive.
13. **Zero external effect** — `fetch`, `XMLHttpRequest`, `node:http(s)`, and `child_process` are
    spied and asserted uncalled across the whole suite; no API key, account, credential, paid route,
    external send, or production deployment is used.

The command and its observed result are recorded in the Stage 8 Issue.

## Implementation Stage handoff

Serial, each Stage starting only after the previous is accepted:

1. **Stage 8 — deterministic core** (implementation): `src/m2/*`, the three JSON Schemas, F1–F18
   fixtures, and the full test matrix. No UI. Build on the M2 contract in this document; every
   number, band, code, and order here is fixed and needs no further product judgment.
2. **Stage 9 — independent review**: bias in the rubric coefficients, sensitivity correctness,
   fail-closed completeness, M1 regression, approval and evidence boundaries; defects fixed and
   regression-tested in the same Stage.
3. **Stage 10 — Gadget UI**: the read-only comparison screen above on local port 3000, no binding, no
   fetch path, with the artifact preview and local export.
4. **Stage 11 — Core Skills and E2E**: apply the four Core Skills explicitly and capture real-browser
   GUI evidence on the Personal MVP runtime.
5. **Stage 12 — real-data PoC design**: after Human approval, data minimization, then JD → job
   posting → candidate gap → onboarding → performance feedback, each as its own Stage.

Open decisions deliberately left to a Human and **not** assumed by this design: the compensation and
employment terms needed for a job posting, whether `MIN_RECOMMENDATION_MARGIN` should differ per
task risk level, and whether a confirmed placement should later be written back into the M1
`Task.executionType` (which requires an M1 schema bump).

## Traceability

| Accepted MOP-588 contract | Where it lands |
| --- | --- |
| Business Analyst input contract | Business Analyst extension model; `TaskAnalysis` |
| Rubric 0–5 definitions | Rubric definitions (0–5), eight rubric tables |
| Feasibility gate, 4 candidates, reason codes | Feasibility gate, BLOCK and UNKNOWN tables |
| Fixed weights 35/20/20/15/10, no zero-imputation | Scoring; gate/score invariant |
| `recommended` / `human_choice` / `undecided`, no auto tie-break | Decision, sensitivity, and fail-closed policy |
| Fail-closed list | Fail-closed conditions table |
| Byte-equivalent determinism | Canonical units; integer weights; `generatedAt` propagation; self-check |
| Human Approval separation | Human Approval boundary; fixed `scopeStatement` |
| 4 draft artifacts, 2 deferred | Draft artifacts; deferred note |
| Gadget one-screen requirements | Gadget contract, regions 1–8 |
| M1 back-compat and migration | Binding to M1 and migration, rules 1–5 |
| Deterministic acceptance conditions | Acceptance and test matrix, F1–F18 and cases 1–13 |
| Serial follow-on Stages | Implementation Stage handoff |

Sources: MOP-588 Human Acceptance comment (2026-08-30 JST), `docs/workforce-compiler-m1-design.md`,
`packages/workforce-compiler/src/{types,validate}.ts`,
`docs/fixtures/workforce-compiler/advertising-strategy-operator.synthetic.json`,
`context-collections/mopro-core-skills/skills/`, `docs/personal-port-registry.md`.

Confirmed facts come from those repository and Issue sources. All fixture values are intentionally
synthetic. Real input mappings, real placement outcomes, and any external action remain unverified
and out of scope for M2.
