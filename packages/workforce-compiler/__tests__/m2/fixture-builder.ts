import type {
  WorkforcePlacementAnalysis,
  TaskAnalysis,
  OptionEstimate,
  ExecutionCandidate,
  Rated,
  EvidenceRef,
  Quantity,
  Money,
  AttainedSkill,
  CostEstimate,
  HumanSelection,
  M2ApprovalGate,
  CounterEvidence,
} from "../../src/m2/types.js";
import { CANDIDATE_ORDER, SCOPE_STATEMENT } from "../../src/m2/rules.js";

const M1_DIGEST =
  "sha256-046858bf3ef170a95ce1ead0e453a96ca9b6f7844178937678a42cac437691c1";

let evidenceCounter = 0;
function ev(
  overrides: Partial<EvidenceRef> = {},
): EvidenceRef {
  evidenceCounter++;
  return {
    id: overrides.id ?? `ev-m2-${evidenceCounter}`,
    status: overrides.status ?? "assumed",
    sourceType: overrides.sourceType ?? "synthetic",
    sourceRef: overrides.sourceRef ?? null,
    claim: overrides.claim ?? "Synthetic M2 fixture value",
    observedAt: null,
    note: null,
    ...overrides,
  };
}

function rated(
  score: 0 | 1 | 2 | 3 | 4 | 5,
  rubricId: string,
  rationale = "Synthetic",
  evidence?: EvidenceRef,
): Rated {
  return {
    score,
    rubricId,
    rationale,
    evidence: evidence ?? ev(),
  };
}

function qty(
  value: number | null,
  unit: string,
  period: string | null,
): Quantity {
  return { value, unit, period: period as any, evidence: ev() };
}

function money(
  amount: number | null,
  currency = "JPY",
  period: string | null = "month",
): Money {
  return { amount, currency, period: period as any, evidence: ev() };
}

function costEst(
  low: number,
  base: number,
  high: number,
  currency = "JPY",
  period: string | null = "year",
): CostEstimate {
  return {
    low: money(low, currency, period),
    base: money(base, currency, period),
    high: money(high, currency, period),
  };
}

function attainedSkill(
  skillId: string,
  level: 1 | 2 | 3 | 4 | 5 | null,
): AttainedSkill {
  return { skillId, attainedLevel: level, evidence: ev() };
}

export function makeOptionEstimate(
  candidate: ExecutionCandidate,
  overrides: Partial<OptionEstimate> = {},
): OptionEstimate {
  const defaults: Record<ExecutionCandidate, Partial<OptionEstimate>> = {
    ai: {
      setupTime: qty(480, "minute", "year"),
      setupCost: costEst(100000, 200000, 300000),
      runTime: qty(30, "minute", "event"),
      runCost: costEst(1200000, 1800000, 2400000),
      availableCapacity: qty(480000, "minute", "year"),
      toolAvailability: "available",
      contextAvailability: "available",
      authorityGrantable: true,
      attainableSkills: [
        attainedSkill("skill-unit-economics-analysis", 3),
        attainedSkill("skill-experiment-design", 2),
      ],
      learningTime: qty(120, "minute", "year"),
      expectedQuality: rated(4, "rubric.expectedQuality/1.0.0"),
      reversibility: rated(5, "rubric.reversibility/1.0.0"),
      learningValue: rated(3, "rubric.learningValue/1.0.0"),
      confidence: rated(3, "rubric.confidence/1.0.0"),
    },
    existing_staff: {
      setupTime: qty(60, "minute", "year"),
      setupCost: costEst(0, 0, 0),
      runTime: qty(90, "minute", "event"),
      runCost: costEst(4800000, 6000000, 7200000),
      availableCapacity: qty(28800, "minute", "year"),
      toolAvailability: "available",
      contextAvailability: "available",
      authorityGrantable: true,
      attainableSkills: [
        attainedSkill("skill-unit-economics-analysis", 3),
        attainedSkill("skill-experiment-design", 2),
      ],
      learningTime: qty(60, "minute", "year"),
      expectedQuality: rated(3, "rubric.expectedQuality/1.0.0"),
      reversibility: rated(4, "rubric.reversibility/1.0.0"),
      learningValue: rated(4, "rubric.learningValue/1.0.0"),
      confidence: rated(4, "rubric.confidence/1.0.0"),
    },
    hire: {
      setupTime: qty(10080, "minute", "year"),
      setupCost: costEst(500000, 800000, 1200000),
      runTime: qty(90, "minute", "event"),
      runCost: costEst(4800000, 6000000, 7200000),
      availableCapacity: qty(28800, "minute", "year"),
      toolAvailability: "available",
      contextAvailability: "available",
      authorityGrantable: true,
      attainableSkills: [
        attainedSkill("skill-unit-economics-analysis", 4),
        attainedSkill("skill-experiment-design", 3),
      ],
      learningTime: qty(2880, "minute", "year"),
      expectedQuality: rated(4, "rubric.expectedQuality/1.0.0"),
      reversibility: rated(2, "rubric.reversibility/1.0.0"),
      learningValue: rated(5, "rubric.learningValue/1.0.0"),
      confidence: rated(3, "rubric.confidence/1.0.0"),
    },
    outsource: {
      setupTime: qty(2880, "minute", "year"),
      setupCost: costEst(200000, 400000, 600000),
      runTime: qty(90, "minute", "event"),
      runCost: costEst(3600000, 4800000, 6000000),
      availableCapacity: qty(28800, "minute", "year"),
      toolAvailability: "available",
      contextAvailability: "available",
      authorityGrantable: true,
      attainableSkills: [
        attainedSkill("skill-unit-economics-analysis", 3),
        attainedSkill("skill-experiment-design", 3),
      ],
      learningTime: qty(480, "minute", "year"),
      expectedQuality: rated(3, "rubric.expectedQuality/1.0.0"),
      reversibility: rated(3, "rubric.reversibility/1.0.0"),
      learningValue: rated(1, "rubric.learningValue/1.0.0"),
      confidence: rated(3, "rubric.confidence/1.0.0"),
    },
  };

  return {
    candidate,
    setupTime: qty(60, "minute", "year"),
    setupCost: costEst(0, 0, 0),
    runTime: qty(90, "minute", "event"),
    runCost: costEst(4800000, 6000000, 7200000),
    availableCapacity: qty(28800, "minute", "year"),
    toolAvailability: "available",
    contextAvailability: "available",
    authorityGrantable: true,
    attainableSkills: [
      attainedSkill("skill-unit-economics-analysis", 3),
      attainedSkill("skill-experiment-design", 2),
    ],
    learningTime: qty(60, "minute", "year"),
    expectedQuality: rated(3, "rubric.expectedQuality/1.0.0"),
    reversibility: rated(3, "rubric.reversibility/1.0.0"),
    learningValue: rated(3, "rubric.learningValue/1.0.0"),
    confidence: rated(3, "rubric.confidence/1.0.0"),
    evidence: [ev()],
    ...defaults[candidate],
    ...overrides,
  };
}

export function makeTaskAnalysis(
  taskId = "task-platform-fit-assessment",
  overrides: Partial<TaskAnalysis> = {},
  optionOverrides: Partial<Record<ExecutionCandidate, Partial<OptionEstimate>>> = {},
): TaskAnalysis {
  return {
    taskId,
    workCharacteristics: overrides.workCharacteristics ?? {
      repeatability: rated(4, "rubric.repeatability/1.0.0"),
      digitality: rated(5, "rubric.digitality/1.0.0"),
      exceptionRate: rated(1, "rubric.exceptionRate/1.0.0"),
      judgmentEmpathy: rated(1, "rubric.judgmentEmpathy/1.0.0"),
      specifiability: rated(4, "rubric.specifiability/1.0.0"),
      procedureSteps: ["Gather inputs", "Analyze platform fit", "Write memo"],
      knownExceptions: [],
    },
    operatingConstraints: overrides.operatingConstraints ?? {
      deadline: null,
      requiredAvailability: "business_hours",
      dataSensitivity: "internal",
      requiredAuthority: "draft",
      mustInternal: false,
      forbiddenExecutionTypes: [],
      legalConstraints: [],
      contractConstraints: [],
      securityConstraints: [],
      evidence: [ev()],
    },
    demand: overrides.demand ?? {
      frequency: qty(2, "assessments", "week"),
      volume: qty(1, "platforms", "event"),
      variabilityPct: qty(10, "percent", null),
      peakVolume: qty(3, "platforms", "week"),
      slaTurnaround: qty(120, "minute", "event"),
    },
    currentState: overrides.currentState ?? {
      ownerRoleId: "role-ad-strategy-operator",
      capacity: qty(2400, "minute", "month"),
      skillProfile: [
        attainedSkill("skill-unit-economics-analysis", 3),
        attainedSkill("skill-experiment-design", 2),
      ],
      timeSpent: qty(180, "minute", "week"),
      costPerPeriod: money(500000, "JPY", "month"),
      qualityRecord: rated(3, "rubric.qualityRecord/1.0.0"),
      evidence: [ev()],
    },
    optionEstimates: CANDIDATE_ORDER.map((c) =>
      makeOptionEstimate(c, optionOverrides[c]),
    ),
    counterEvidence: overrides.counterEvidence ?? [],
  };
}

export function makeAnalysis(
  overrides: Partial<WorkforcePlacementAnalysis> = {},
  taskOverrides: Partial<TaskAnalysis> = {},
  optionOverrides: Partial<Record<ExecutionCandidate, Partial<OptionEstimate>>> = {},
): WorkforcePlacementAnalysis {
  evidenceCounter = 0;
  const taskId =
    taskOverrides.taskId ?? "task-platform-fit-assessment";
  return {
    schemaVersion: "2.0.0",
    analysisId: overrides.analysisId ?? "wpa-test-fixture",
    analysisVersion: "1.0.0",
    ruleSetVersion: "wc-m2-rules/1.0.0",
    generatedAt: "2026-08-30T00:00:00Z",
    evaluationHorizonYears: 1,
    definitionRef: overrides.definitionRef ?? {
      definitionId: "wd-marketing-ad-strategy-synthetic-m1",
      schemaVersion: "1.0.0",
      contentDigest: M1_DIGEST,
    },
    provenance: {
      kind: "synthetic",
      generatedAt: "2026-08-30T00:00:00Z",
      sources: [ev({ id: "ev-m2-prov", claim: "M2 synthetic fixture" })],
    },
    scopeTaskIds: overrides.scopeTaskIds ?? [taskId],
    taskAnalyses: overrides.taskAnalyses ?? [
      makeTaskAnalysis(taskId, taskOverrides, optionOverrides),
    ],
    humanSelections: overrides.humanSelections ?? [],
  };
}

export function makeHumanSelection(
  taskId: string,
  candidate: ExecutionCandidate,
  state: "approved" | "draft" | "pending" = "approved",
): HumanSelection {
  return {
    taskId,
    selectedExecutionType: candidate,
    selectedAt: "2026-08-30T01:00:00Z",
    rationale: `Selected ${candidate} for ${taskId}`,
    approval: {
      requiresHumanApproval: true,
      state,
      actionType: "placement_commit",
      target: taskId,
      candidate,
      totalScore: 0,
      runnerUp: null,
      margin: null,
      topSupportingEvidence: [],
      topCounterEvidence: [],
      costRange: {
        low: money(0, "JPY", "year"),
        base: money(0, "JPY", "year"),
        high: money(0, "JPY", "year"),
      },
      riskLevel: "low",
      reversibility: 3,
      lowestConfidence: 3,
      proposedDiff: `Set executionType to ${candidate}`,
      expectedResult: `Task assigned to ${candidate}`,
      downside: "Reversal costs apply",
      rollback: "Revert to undecided",
      idempotencyKey: `placement-${taskId}-${candidate}`,
      scopeStatement: SCOPE_STATEMENT,
    },
  };
}

export { M1_DIGEST };
