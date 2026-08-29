# Workforce Compiler M1 solution design

Status: Stage 2 implementation contract for MOP-579  
Baseline: `mopro/personal-mvp` at `7cbb85cb1b55fdd56e20415e6e38f822b1df9a8b`  
Target occupation: Advertising Strategy Operator (`marketing-ad-strategy`)

This document turns the Human-accepted MOP-578 requirements into an implementable M1 contract.
M1 is a local, synthetic, read-only compiler and viewer. It does not recommend a workforce option,
call a model or external service, persist business data, or execute an advertising action.

## Decision summary

- The aggregate root is a versioned `WorkforceDefinition` document containing `businesses`,
  `processes`, `tasks`, and `skills`. Relationships use IDs only.
- JSON Schema Draft 2020-12 validates shape and local field constraints. A deterministic semantic
  validator enforces uniqueness, references, ownership, graph, approval, and evidence rules that
  JSON Schema cannot express clearly.
- The synthetic fixture describes one paid-acquisition business, two or more processes, two or more
  tasks per process, and at least one skill reused by multiple tasks.
- The Gadget is a deterministic read-only viewer and validation-result presenter. The Agent may
  draft or revise documents and explain failures, but the validator is the authority for acceptance.
- M1 needs no Gatekeeper, AI-model, agent-spawner, credential, or network binding. Any future
  external action is a separate post-M1 capability and remains Human Approval-gated.

## Artifact topology

Stage 3 should use this layout:

```text
packages/workforce-compiler/
  package.json
  src/
    schema/workforce-definition.schema.json
    types.ts
    validate.ts
    index.ts
  __tests__/
    validate.test.ts
docs/fixtures/workforce-compiler/
  advertising-strategy-operator.synthetic.json
docs/workforce-compiler.md
```

`packages/workforce-compiler` is a pure TypeScript library with no Worker, storage, RPC, model, or
network dependency. The future Gadget consumes its validation output; it must not duplicate the
validation rules. `docs/workforce-compiler.md` becomes the user-facing vocabulary and rerun guide,
while this file remains the architecture contract.

## Aggregate and identity contract

```ts
interface WorkforceDefinition {
  schemaVersion: "1.0.0";
  definitionId: string;
  title: string;
  occupationCatalogId: "marketing-ad-strategy";
  provenance: DocumentProvenance;
  businesses: Business[];
  processes: Process[];
  tasks: Task[];
  skills: Skill[];
}
```

IDs are stable lower-kebab-case strings prefixed by entity kind: `biz-`, `proc-`, `task-`, and
`skill-`. They are unique across the entire document, not merely within one collection. Names are
labels and never joins. Arrays preserve author order for display; validator output is sorted by
`path`, then `code`, so identical input produces byte-equivalent results.

The schema is closed at every object level with `additionalProperties: false`. Every object has all
required properties explicitly listed. Optional facts are represented as nullable typed values;
missing required keys never mean “unknown”. Numbers must be finite and non-negative.

## Common value objects

```ts
type EvidenceStatus = "observed" | "assumed" | "unverified";

interface EvidenceRef {
  id: string;
  status: EvidenceStatus;
  sourceType: "repository" | "notion" | "issue" | "synthetic" | "human" | "other";
  sourceRef: string | null;
  claim: string;
  observedAt: string | null; // RFC 3339; required when status=observed
  note: string | null;
}

interface DocumentProvenance {
  kind: "synthetic" | "real";
  generatedAt: string; // RFC 3339
  sources: EvidenceRef[];
}

interface Quantity {
  value: number | null;
  unit: string;
  period: "event" | "day" | "week" | "month" | "quarter" | "year" | null;
  evidence: EvidenceRef;
}

interface Money {
  amount: number | null;
  currency: string; // ISO 4217, fixture uses JPY
  period: "event" | "day" | "week" | "month" | "quarter" | "year" | null;
  evidence: EvidenceRef;
}

interface Metric {
  id: string;
  name: string;
  unit: string;
  currentValue: number | null;
  targetValue: number | null;
  deadline: string | null; // YYYY-MM-DD
  measurementMethod: string;
  successCondition: string;
  stopCondition: string;
  evidence: EvidenceRef;
}

interface AcceptanceCriterion {
  id: string;
  statement: string;
  verificationMethod: string;
  requiredEvidence: string;
}
```

An `assumed` or `unverified` numeric value remains nullable when no defensible synthetic assumption
is intentionally being tested. Synthetic values use `sourceType: "synthetic"` and never
`status: "observed"`. `observed` requires both a non-null `sourceRef` and `observedAt`.

## Entity contract

### Business

```ts
interface Business {
  id: string;
  name: string;
  purpose: string;
  targetCustomers: string[];
  valueProposition: string;
  outcomeMetrics: Metric[];
  processIds: string[]; // non-empty; each referenced Process points back here
  constraints: string[];
  evidence: EvidenceRef[]; // non-empty
}
```

The fixture contains exactly one Business. The schema permits more than one so the common model
does not encode the pilot limitation, but each Process has exactly one owning Business.

### Process

```ts
interface Process {
  id: string;
  businessId: string;
  name: string;
  purpose: string;
  trigger: string;
  exitCondition: string;
  kpis: Metric[];
  taskIds: string[]; // non-empty; ordered execution/display sequence
  dependsOnProcessIds: string[];
  evidence: EvidenceRef[]; // non-empty
}
```

`dependsOnProcessIds` forms a directed acyclic graph. Self-dependencies and cycles are invalid.
Process dependencies express prerequisites, not ownership or task flow.

### Skill

```ts
interface Skill {
  id: string;
  name: string;
  description: string;
  levelScale: {
    min: 1;
    max: 5;
    labels: [string, string, string, string, string];
  };
  evidence: EvidenceRef[]; // non-empty
}

interface RequiredSkill {
  skillId: string;
  requiredLevel: 1 | 2 | 3 | 4 | 5;
  rationale: string;
}
```

A Skill is a reusable capability such as experiment design or unit-economics analysis. A product,
tool, procedure, or credential is not a Skill. Required level must fall inside the referenced
Skill's scale.

### Task

```ts
type RiskLevel = "low" | "medium" | "high" | "critical";
type Authority = "draft" | "recommend" | "execute_after_approval";
type ApprovalState = "not_required" | "draft" | "pending" | "approved" | "rejected" | "executed";

interface ApprovalGate {
  requiresHumanApproval: boolean;
  state: ApprovalState;
  actionType: "none" | "external_write" | "publish" | "account_connect" | "budget_commit" |
    "campaign_launch" | "budget_change" | "campaign_pause" | "audience_upload" |
    "creative_publish" | "destructive_change" | "production_deploy";
  target: string | null;
  proposedDiff: string | null;
  expectedResult: string | null;
  downside: string | null;
  rollback: string | null;
  idempotencyKey: string | null;
}

interface Task {
  id: string;
  processId: string;
  name: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  frequency: Quantity;
  volume: Quantity;
  requiredSkills: RequiredSkill[];
  risk: { level: RiskLevel; reasons: string[] };
  authority: Authority;
  approval: ApprovalGate;
  currentOwner: string | null;
  currentTime: Quantity;
  currentCost: Money;
  kpi: Metric[];
  qualityStandard: AcceptanceCriterion[];
  evidence: EvidenceRef[];
  executionType: "undecided";
}
```

All Task arrays except `risk.reasons` are non-empty. A Task belongs to exactly one Process through
`processId`; the owning Process must list it exactly once in `taskIds`, and no other Process may list
it. `executionType` is deliberately fixed to `undecided`; recommendation scoring belongs after M1.

## Approval invariants

The following action types are side-effecting and require approval:

```text
external_write, publish, account_connect, budget_commit, campaign_launch,
budget_change, campaign_pause, audience_upload, creative_publish,
destructive_change, production_deploy
```

For these values, `requiresHumanApproval` is true, `authority` is
`execute_after_approval`, and `target`, `proposedDiff`, `expectedResult`, `downside`, `rollback`, and
`idempotencyKey` are non-empty. Before execution, state may only be `draft`, `pending`, `approved`,
or `rejected`. M1 fixtures must remain `draft`; `executed` is rejected because M1 has no executor.

For `actionType: "none"`, approval is `{ requiresHumanApproval: false, state: "not_required", ... }`
and all action detail fields are null. Drafting or analysis that merely precedes a future external
action is `authority: "draft"` or `recommend`, never evidence that approval was granted.

## JSON Schema and semantic validation split

JSON Schema owns:

- required keys, closed objects, primitive types, formats, string lengths, array minima;
- ID patterns and fixed `schemaVersion`/occupation/execution values;
- enums, numeric lower bounds, and unit/currency presence;
- conditional field presence for observed evidence and approval action types.

The semantic validator owns:

- global ID and local child-ID uniqueness;
- existence and kind of every reference;
- Business/Process and Process/Task bidirectional consistency;
- exactly-one Process ownership for every Task;
- Process dependency cycle detection;
- required skill level within the referenced scale;
- at least one Skill referenced by two or more Tasks in the M1 fixture profile;
- synthetic provenance cannot claim `observed` evidence;
- approval invariants and the M1 ban on `executed`;
- deterministic traversal from Business to Process to Task to Skill and reverse Skill usage index.

```ts
interface ValidationIssue {
  code: string;
  path: string;       // RFC 6901 JSON Pointer
  message: string;
  severity: "error";
  relatedIds: string[];
}

interface ValidationResult {
  valid: boolean;
  schemaVersion: "1.0.0" | null;
  issues: ValidationIssue[];
  indexes: null | {
    processIdsByBusinessId: Record<string, string[]>;
    taskIdsByProcessId: Record<string, string[]>;
    skillIdsByTaskId: Record<string, string[]>;
    taskIdsBySkillId: Record<string, string[]>;
  };
}
```

Invalid input returns all safely discoverable issues; it never throws for user data. Programmer or
schema-loading failures may throw. `indexes` is emitted only when valid, with keys and values sorted.

Required error codes include:

```text
SCHEMA_INVALID, ID_DUPLICATE, REFERENCE_MISSING, REFERENCE_WRONG_KIND,
OWNERSHIP_MISMATCH, TASK_MULTIPLE_PROCESSES, PROCESS_DEPENDENCY_CYCLE,
SKILL_LEVEL_OUT_OF_RANGE, SKILL_NOT_REUSED, SYNTHETIC_OBSERVED_CONFLICT,
APPROVAL_GATE_REQUIRED, APPROVAL_DETAILS_REQUIRED, APPROVAL_STATE_FORBIDDEN_M1
```

## Synthetic fixture profile

The fixture models a hypothetical B2B SaaS paid-acquisition operation and is clearly labeled
synthetic. It contains:

- one Business with a goal, deadline, current value, success condition, and stop condition;
- Process 1, strategy and experiment design: platform fit assessment plus forecast/campaign draft;
- Process 2, measurement and optimization: measurement-readiness review plus continue/change/stop
  recommendation;
- at least four Tasks total, with two Tasks owned by each Process;
- shared skills including unit-economics analysis and experiment design;
- an approval-gated campaign-launch draft card containing the complete proposed-action fields but
  no account, credential, real audience, external target identifier, or executable action;
- pessimistic/base/optimistic ranges represented as documented outputs or inputs, never guarantees;
- only synthetic/assumed/unverified evidence, with no value presented as observed.

Names and numbers are examples, not claims about the owner or an actual customer. No personal data
or proprietary business data is permitted in this fixture.

## Gadget and Agent boundary

### Gadget responsibilities

- Load a bundled or user-supplied document locally and invoke the shared validator.
- Present a Business → Process → Task → Skill explorer and reverse Skill → Tasks view.
- Show evidence status at the value/task level and never collapse assumed/unverified into confirmed.
- Show validation issues with code and JSON Pointer.
- Render approval cards as non-executing previews and visibly label them `draft`.
- Export the validated document and validation report locally.

The M1 Gadget must not have a fetch path, secret, Gatekeeper binding, AI-model binding, Agent
Spawner binding, ad-account connector, or action endpoint. It cannot mutate external state.

### Agent responsibilities

- Help a user draft or revise a definition, state assumptions, and explain validator errors.
- Preserve source/evidence classification and propose the smallest missing evidence needed.
- Run the same validator before calling a draft complete.
- Stop at an approval preview; never interpret the document's approval state as platform authority.

The Agent does not decide AI/Existing Staff/Hire/Outsource, estimate a skill gap, generate a JD/SOW,
or execute advertising. Agent prose cannot override an invalid validator result.

### Future binding boundary

If a later milestone introduces persistent external reads or writes, connections must be explicit
named Gadget bindings configured by the user. Blueprint metadata may describe the binding shape but
must not contain credentials. Any external write remains queued behind a concrete Human Approval;
adding a connection never implies approval to act.

## Acceptance and test contract

Stage 3 is accepted only when one local command runs all of the following deterministically:

1. The canonical synthetic fixture passes schema and semantic validation.
2. The returned forward indexes reproduce every declared hierarchy edge, and the reverse skill
   index shows at least one skill used by two or more tasks.
3. Separate mutations reject: missing required field, invalid enum, missing reference, wrong-kind
   reference, duplicate ID, Task listed by zero or two Processes, Process cycle, negative
   time/cost/volume, missing unit/currency/period where required, out-of-range skill level, no reused
   skill, approval action without a gate, incomplete approval details, synthetic evidence marked
   observed, and missing evidence status.
4. Approval mutation tests cover every side-effecting `actionType`; none can validate with
   `requiresHumanApproval: false`, incomplete details, or `state: "executed"`.
5. Repeated validation of the same fixture produces deeply equal results and sorted indexes/issues.
6. Tests use no API key, network, paid route, external send, account, credential, or production
   deployment.

The test command and observed result must be recorded in the Stage 3 Issue. Quality Gate outcome is
`合格` only when all required cases pass, `条件付き合格` only for explicitly non-M1 environment
checks, and `未合格` for any contract failure. A document, UI, or test name existing is not proof;
the observable validator result is the evidence.

## Out of scope and decision gates

M1 excludes real-data ingestion, interviews, model inference, recommendation/scoring, workforce
allocation, candidate profiles, JD/job post/Agent Spec/SOW/Skill Gap/onboarding generation,
persistence, collaboration, connectors, external APIs, production deployment, and real-company PoC.

Human Approval is mandatory before any production deploy, external send/publication, credential or
permission grant, real ad-account connection, budget commitment or paid use, campaign launch/change/
pause, audience upload, creative publication, real or personal data ingestion, or destructive change.

## Traceability

- Human-accepted requirements: MOP-578 handoff and MOP-577 acceptance comment, 2026-08-30 JST.
- Product evidence: `docs/marketing-growth-agents.md` and
  `packages/workshop-frontend/src/agentCatalog.ts`.
- Shared safeguards: `context-collections/mopro-core-skills/skills/`.
- Local runtime boundary: `docs/personal-port-registry.md` and
  `docs/personal-local-operations.md`.
- Blueprint/binding behavior: `docs/blueprints.md`.

Confirmed facts above come from these repository and Issue sources. The fixture contents and its
business values are intentionally synthetic. Real input mappings and future workforce decisions
remain unverified and out of scope.
