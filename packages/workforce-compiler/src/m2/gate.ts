import {
  canonicalizePerYear,
  computeFrequencyPerYear,
  slackMinutes,
} from "./canonical.js";
import {
  CANDIDATE_ORDER,
  MINUTES_PER_YEAR_24X7,
  OWNER_ROLE_PATTERN,
} from "./rules.js";
import type {
  CandidateResult,
  ExecutionCandidate,
  OperatingConstraints,
  OptionEstimate,
  TaskAnalysis,
  WorkforcePlacementAnalysis,
} from "./types.js";

function constraintProhibitsCandidate(
  constraint: string,
  candidate: ExecutionCandidate,
): boolean {
  const colonIdx = constraint.indexOf(":");
  if (colonIdx < 0) return false;
  const prefix = constraint
    .slice(0, colonIdx)
    .trim()
    .toLowerCase()
    .replace(/ /g, "_");
  return prefix === candidate;
}

export interface GateContext {
  analysis: WorkforcePlacementAnalysis;
  taskAnalysis: TaskAnalysis;
  taskIndex: number;
  requiredSkillIds: string[];
  requiredSkillLevels: Map<string, number>;
}

export function evaluateGate(ctx: GateContext): CandidateResult[] {
  const { taskAnalysis: ta, analysis } = ctx;
  const freqResult = computeFrequencyPerYear(ta.demand.frequency);
  const frequencyPerYear = freqResult.ok ? freqResult.value : null;

  return CANDIDATE_ORDER.map((candidate) => {
    const blockCodes: string[] = [];
    const unknownCodes: string[] = [];
    const oe = ta.optionEstimates.find((o) => o.candidate === candidate);
    if (!oe) {
      return {
        candidate,
        verdict: "unknown" as const,
        reasonCodes: ["FG_INPUT_MISSING"],
        totalScore: null,
        breakdown: null,
      };
    }

    evaluateBlockRules(candidate, oe, ta, analysis, ctx, frequencyPerYear, blockCodes);
    evaluateUnknownRules(candidate, oe, ta, ctx, unknownCodes);

    blockCodes.sort();
    unknownCodes.sort();

    let verdict: "eligible" | "ineligible" | "unknown";
    let reasonCodes: string[];
    if (blockCodes.length > 0) {
      verdict = "ineligible";
      reasonCodes = [...blockCodes, ...unknownCodes].sort();
    } else if (unknownCodes.length > 0) {
      verdict = "unknown";
      reasonCodes = unknownCodes;
    } else {
      verdict = "eligible";
      reasonCodes = [];
    }

    return {
      candidate,
      verdict,
      reasonCodes,
      totalScore: null,
      breakdown: null,
    };
  });
}

function evaluateBlockRules(
  candidate: ExecutionCandidate,
  oe: OptionEstimate,
  ta: TaskAnalysis,
  analysis: WorkforcePlacementAnalysis,
  ctx: GateContext,
  frequencyPerYear: number | null,
  codes: string[],
): void {
  const oc = ta.operatingConstraints;

  if (oc.forbiddenExecutionTypes.includes(candidate)) {
    codes.push("FG_FORBIDDEN_BY_CONSTRAINT");
  }

  if (oc.mustInternal && candidate === "outsource") {
    codes.push("FG_MUST_INTERNAL");
  }

  if (oe.toolAvailability === "unavailable") {
    codes.push("FG_TOOL_UNAVAILABLE");
  }

  if (oe.contextAvailability === "unavailable") {
    codes.push("FG_CONTEXT_UNAVAILABLE");
  }

  if (
    oc.requiredAuthority === "execute_after_approval" &&
    oe.authorityGrantable === false
  ) {
    codes.push("FG_AUTHORITY_UNAVAILABLE");
  }

  if (
    oc.dataSensitivity === "restricted" &&
    (candidate === "ai" || candidate === "outsource")
  ) {
    codes.push("FG_DATA_SENSITIVITY_EXCEEDED");
  }

  if (oc.deadline !== null) {
    const setupResult = canonicalizePerYear(
      oe.setupTime.value,
      oe.setupTime.period,
      frequencyPerYear,
    );
    const learningResult = canonicalizePerYear(
      oe.learningTime.value,
      oe.learningTime.period,
      frequencyPerYear,
    );
    const setupVal = oe.setupTime.value ?? 0;
    const learningVal = oe.learningTime.value ?? 0;
    const totalPrepMinutes = setupVal + learningVal;
    const slack = slackMinutes(analysis.generatedAt, oc.deadline);
    if (totalPrepMinutes > slack) {
      codes.push("FG_DEADLINE_UNREACHABLE");
    }

    const maxGap = computeMaxSkillGap(oe, ctx);
    if (
      maxGap >= 3 &&
      (candidate === "existing_staff" || candidate === "hire") &&
      learningVal > slack
    ) {
      codes.push("FG_SKILL_GAP_UNCLOSABLE");
    }
  } else {
    const maxGap = computeMaxSkillGap(oe, ctx);
    if (
      maxGap >= 3 &&
      (candidate === "existing_staff" || candidate === "hire")
    ) {
      const learningVal = oe.learningTime.value ?? 0;
      // No deadline: skill gap unclosable only if deadline exists, skip
    }
  }

  const avCapResult = canonicalizePerYear(
    oe.availableCapacity.value,
    oe.availableCapacity.period,
    frequencyPerYear,
  );
  const runTimeResult = canonicalizePerYear(
    oe.runTime.value,
    oe.runTime.period,
    frequencyPerYear,
  );
  if (avCapResult.ok && runTimeResult.ok) {
    if (avCapResult.value < runTimeResult.value) {
      codes.push("FG_CAPACITY_INSUFFICIENT");
    }
  }

  if (
    oc.requiredAvailability === "24x7" &&
    (candidate === "existing_staff" || candidate === "hire")
  ) {
    if (avCapResult.ok && avCapResult.value < MINUTES_PER_YEAR_24X7) {
      codes.push("FG_AVAILABILITY_UNMET");
    }
  }

  const allConstraints = [
    ...oc.legalConstraints,
    ...oc.contractConstraints,
    ...oc.securityConstraints,
  ];
  for (const c of allConstraints) {
    if (constraintProhibitsCandidate(c, candidate)) {
      codes.push("FG_LEGAL_CONSTRAINT");
      break;
    }
  }
}

function evaluateUnknownRules(
  candidate: ExecutionCandidate,
  oe: OptionEstimate,
  ta: TaskAnalysis,
  ctx: GateContext,
  codes: string[],
): void {
  const scoreInputs: Array<{ value: unknown; evidence: { status: string } | null }> =
    [
      { value: oe.setupTime.value, evidence: oe.setupTime.evidence },
      { value: oe.setupCost.base.amount, evidence: oe.setupCost.base.evidence },
      { value: oe.runTime.value, evidence: oe.runTime.evidence },
      { value: oe.runCost.base.amount, evidence: oe.runCost.base.evidence },
      {
        value: oe.availableCapacity.value,
        evidence: oe.availableCapacity.evidence,
      },
      { value: oe.learningTime.value, evidence: oe.learningTime.evidence },
      { value: oe.expectedQuality.score, evidence: oe.expectedQuality.evidence },
      { value: oe.reversibility.score, evidence: oe.reversibility.evidence },
      { value: oe.learningValue.score, evidence: oe.learningValue.evidence },
    ];

  for (const skill of oe.attainableSkills) {
    if (ctx.requiredSkillIds.includes(skill.skillId)) {
      scoreInputs.push({
        value: skill.attainedLevel,
        evidence: skill.evidence,
      });
    }
  }

  let hasMissing = false;
  let hasUnverified = false;
  for (const input of scoreInputs) {
    if (input.value === null) hasMissing = true;
    if (input.evidence && input.evidence.status === "unverified")
      hasUnverified = true;
  }

  if (hasMissing) codes.push("FG_INPUT_MISSING");
  if (hasUnverified) codes.push("FG_EVIDENCE_UNVERIFIED");

  if (oe.toolAvailability === "unknown") codes.push("FG_TOOL_UNKNOWN");
  if (oe.contextAvailability === "unknown") codes.push("FG_CONTEXT_UNKNOWN");

  if (
    ta.operatingConstraints.requiredAuthority === "execute_after_approval" &&
    oe.authorityGrantable === null
  ) {
    codes.push("FG_AUTHORITY_UNKNOWN");
  }

  for (const skillId of ctx.requiredSkillIds) {
    const attained = oe.attainableSkills.find((s) => s.skillId === skillId);
    if (attained && attained.attainedLevel === null) {
      codes.push("FG_SKILL_LEVEL_UNKNOWN");
      break;
    }
    if (!attained) {
      codes.push("FG_SKILL_LEVEL_UNKNOWN");
      break;
    }
  }
}

function computeMaxSkillGap(
  oe: OptionEstimate,
  ctx: GateContext,
): number {
  let maxGap = 0;
  for (const skillId of ctx.requiredSkillIds) {
    const required = ctx.requiredSkillLevels.get(skillId) ?? 0;
    const attained = oe.attainableSkills.find((s) => s.skillId === skillId);
    const level = attained?.attainedLevel ?? 0;
    const gap = Math.max(0, required - level);
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}
