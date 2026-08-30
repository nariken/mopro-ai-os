import {
  canonicalizeMoneyPerYear,
  canonicalizePerYear,
  clamp,
  computeFrequencyPerYear,
  slackMinutes,
} from "./canonical.js";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
import {
  CANDIDATE_ORDER,
  COMPONENT_ORDER,
  COMPONENT_WEIGHTS,
  aiShapeAdjust,
  outsourceShapeAdjust,
  riskPenalty,
  skillFitBase,
} from "./rules.js";
import type {
  CandidateResult,
  ComponentScore,
  ExecutionCandidate,
  OptionEstimate,
  RankEntry,
  RubricScore,
  TaskAnalysis,
  WorkforcePlacementAnalysis,
} from "./types.js";

export interface ScoreContext {
  analysis: WorkforcePlacementAnalysis;
  taskAnalysis: TaskAnalysis;
  requiredSkillIds: string[];
  requiredSkillLevels: Map<string, number>;
  taskRiskLevel: string;
  taskIndex: number;
}

function nearBoundaryCheck(
  actual: number,
  threshold: number,
): boolean {
  if (threshold === 0) return actual === 0;
  return 10 * Math.abs(actual - threshold) <= Math.abs(threshold);
}

export function scoreCandidate(
  candidate: ExecutionCandidate,
  ctx: ScoreContext,
): { totalScore: number; breakdown: ComponentScore[] } {
  const oe = ctx.taskAnalysis.optionEstimates.find(
    (o) => o.candidate === candidate,
  )!;
  const ta = ctx.taskAnalysis;
  const freqResult = computeFrequencyPerYear(ta.demand.frequency);
  const frequencyPerYear = freqResult.ok ? freqResult.value : null;

  const capabilityResult = computeCapability(candidate, oe, ctx);
  const capacityTimeResult = computeCapacityTime(
    candidate,
    oe,
    ctx,
    frequencyPerYear,
  );
  const qualityRiskResult = computeQualityRisk(candidate, oe, ctx);
  const totalCostResult = computeTotalCost(oe, ctx, frequencyPerYear);
  const revLearnResult = computeReversibilityLearning(oe);

  const components: Array<{
    name: (typeof COMPONENT_ORDER)[number];
    sub: RubricScore;
    nearBoundary: boolean;
    paths: string[];
  }> = [
    capabilityResult,
    capacityTimeResult,
    qualityRiskResult,
    totalCostResult,
    revLearnResult,
  ];

  const breakdown: ComponentScore[] = components.map((c) => {
    const weight = COMPONENT_WEIGHTS[c.name];
    const points = (weight / 5) * c.sub;
    return {
      component: c.name,
      subScore: c.sub,
      weight,
      points,
      inputPaths: c.paths.sort(),
      nearBoundary: c.nearBoundary,
    };
  });

  const totalScore = breakdown.reduce((sum, b) => sum + b.points, 0);

  return { totalScore, breakdown };
}

function computeCapability(
  candidate: ExecutionCandidate,
  oe: OptionEstimate,
  ctx: ScoreContext,
): {
  name: "capability";
  sub: RubricScore;
  nearBoundary: boolean;
  paths: string[];
} {
  const ta = ctx.taskAnalysis;
  const tiBase = `/taskAnalyses/${ctx.taskIndex}`;
  const oeIdx = ta.optionEstimates.indexOf(oe);
  const oeBase = `${tiBase}/optionEstimates/${oeIdx}`;

  let maxGap = 0;
  const paths: string[] = [];
  for (const skillId of ctx.requiredSkillIds) {
    const required = ctx.requiredSkillLevels.get(skillId) ?? 0;
    const attained = oe.attainableSkills.find((s) => s.skillId === skillId);
    const level = attained?.attainedLevel ?? 0;
    const gap = Math.max(0, required - level);
    if (gap > maxGap) maxGap = gap;
    const aIdx = oe.attainableSkills.findIndex((s) => s.skillId === skillId);
    if (aIdx >= 0) {
      paths.push(`${oeBase}/attainableSkills/${aIdx}/attainedLevel`);
    }
  }

  const base = skillFitBase(maxGap);
  let adjust = 0;
  const wc = ta.workCharacteristics;

  if (candidate === "ai") {
    const shape =
      wc.repeatability.score +
      wc.digitality.score +
      wc.specifiability.score +
      (5 - wc.exceptionRate.score) +
      (5 - wc.judgmentEmpathy.score);
    adjust = aiShapeAdjust(shape);
    paths.push(
      `${tiBase}/workCharacteristics/repeatability/score`,
      `${tiBase}/workCharacteristics/digitality/score`,
      `${tiBase}/workCharacteristics/specifiability/score`,
      `${tiBase}/workCharacteristics/exceptionRate/score`,
      `${tiBase}/workCharacteristics/judgmentEmpathy/score`,
    );
  } else if (candidate === "outsource") {
    const shape =
      wc.specifiability.score +
      wc.repeatability.score +
      (5 - wc.judgmentEmpathy.score);
    adjust = outsourceShapeAdjust(shape);
    paths.push(
      `${tiBase}/workCharacteristics/specifiability/score`,
      `${tiBase}/workCharacteristics/repeatability/score`,
      `${tiBase}/workCharacteristics/judgmentEmpathy/score`,
    );
  }

  const sub = clamp(0, 5, base + adjust) as RubricScore;
  const nearBoundary = maxGap > 0 && maxGap <= 2;

  return { name: "capability", sub, nearBoundary, paths };
}

function computeCapacityTime(
  _candidate: ExecutionCandidate,
  oe: OptionEstimate,
  ctx: ScoreContext,
  frequencyPerYear: number | null,
): {
  name: "capacityTime";
  sub: RubricScore;
  nearBoundary: boolean;
  paths: string[];
} {
  const ta = ctx.taskAnalysis;
  const tiBase = `/taskAnalyses/${ctx.taskIndex}`;
  const oeIdx = ta.optionEstimates.indexOf(oe);
  const oeBase = `${tiBase}/optionEstimates/${oeIdx}`;
  const paths = [
    `${oeBase}/setupTime/value`,
    `${oeBase}/learningTime/value`,
    `${oeBase}/availableCapacity/value`,
    `${oeBase}/runTime/value`,
  ];

  const setupVal = oe.setupTime.value ?? 0;
  const learningVal = oe.learningTime.value ?? 0;
  const ready = setupVal + learningVal;
  let nearBound = false;

  let readinessPoints: RubricScore = 5;
  if (ta.operatingConstraints.deadline !== null) {
    const slack = slackMinutes(
      ctx.analysis.generatedAt,
      ta.operatingConstraints.deadline,
    );
    paths.push(`${tiBase}/operatingConstraints/deadline`);

    if (4 * ready <= slack) {
      readinessPoints = 5;
      nearBound = nearBound || nearBoundaryCheck(4 * ready, slack);
    } else if (2 * ready <= slack) {
      readinessPoints = 4;
      nearBound = nearBound || nearBoundaryCheck(2 * ready, slack);
    } else if (4 * ready <= 3 * slack) {
      readinessPoints = 3;
      nearBound = nearBound || nearBoundaryCheck(4 * ready, 3 * slack);
    } else if (ready <= slack) {
      readinessPoints = 2;
      nearBound = nearBound || nearBoundaryCheck(ready, slack);
    } else {
      readinessPoints = 0;
    }
  }

  const runTimeResult = canonicalizePerYear(
    oe.runTime.value,
    oe.runTime.period,
    frequencyPerYear,
  );
  const avCapResult = canonicalizePerYear(
    oe.availableCapacity.value,
    oe.availableCapacity.period,
    frequencyPerYear,
  );

  let marginPoints: RubricScore = 0;
  if (runTimeResult.ok && avCapResult.ok) {
    const required = runTimeResult.value;
    const margin = avCapResult.value - required;

    if (margin >= required) {
      marginPoints = 5;
      nearBound = nearBound || nearBoundaryCheck(margin, required);
    } else if (2 * margin >= required) {
      marginPoints = 4;
      nearBound = nearBound || nearBoundaryCheck(2 * margin, required);
    } else if (4 * margin >= required) {
      marginPoints = 3;
      nearBound = nearBound || nearBoundaryCheck(4 * margin, required);
    } else if (10 * margin >= required) {
      marginPoints = 2;
      nearBound = nearBound || nearBoundaryCheck(10 * margin, required);
    } else if (margin >= 0) {
      marginPoints = 1;
    } else {
      marginPoints = 0;
    }
  }

  const sub = Math.min(readinessPoints, marginPoints) as RubricScore;
  return { name: "capacityTime", sub, nearBoundary: nearBound, paths };
}

function computeQualityRisk(
  candidate: ExecutionCandidate,
  oe: OptionEstimate,
  ctx: ScoreContext,
): {
  name: "qualityRisk";
  sub: RubricScore;
  nearBoundary: boolean;
  paths: string[];
} {
  const ta = ctx.taskAnalysis;
  const tiBase = `/taskAnalyses/${ctx.taskIndex}`;
  const oeIdx = ta.optionEstimates.indexOf(oe);
  const oeBase = `${tiBase}/optionEstimates/${oeIdx}`;

  const paths = [`${oeBase}/expectedQuality/score`];

  const rp = riskPenalty(ctx.taskRiskLevel);
  let sensitivityPenalty = 0;
  if (
    ta.operatingConstraints.dataSensitivity === "confidential" &&
    (candidate === "ai" || candidate === "outsource")
  ) {
    sensitivityPenalty = 1;
    paths.push(`${tiBase}/operatingConstraints/dataSensitivity`);
  }

  const raw = oe.expectedQuality.score - rp - sensitivityPenalty;
  const sub = clamp(0, 5, raw) as RubricScore;
  const nearBoundary = raw === 0 || raw === 5;

  return { name: "qualityRisk", sub, nearBoundary: false, paths };
}

function computeTotalCost(
  oe: OptionEstimate,
  ctx: ScoreContext,
  frequencyPerYear: number | null,
): {
  name: "totalCost";
  sub: RubricScore;
  nearBoundary: boolean;
  paths: string[];
} {
  const ta = ctx.taskAnalysis;
  const tiBase = `/taskAnalyses/${ctx.taskIndex}`;
  const oeIdx = ta.optionEstimates.indexOf(oe);
  const oeBase = `${tiBase}/optionEstimates/${oeIdx}`;
  const Y = ctx.analysis.evaluationHorizonYears;

  const paths = [
    `${oeBase}/setupCost/base/amount`,
    `${oeBase}/runCost/base/amount`,
    `${tiBase}/currentState/costPerPeriod/amount`,
  ];

  const setupCostResult = canonicalizeMoneyPerYear(
    oe.setupCost.base,
    frequencyPerYear,
  );
  const runCostResult = canonicalizeMoneyPerYear(
    oe.runCost.base,
    frequencyPerYear,
  );
  const baselineResult = canonicalizeMoneyPerYear(
    ta.currentState.costPerPeriod,
    frequencyPerYear,
  );

  let nearBound = false;

  if (!setupCostResult.ok || !runCostResult.ok || !baselineResult.ok) {
    return { name: "totalCost", sub: 0, nearBoundary: false, paths };
  }

  const candidateCost = setupCostResult.value + runCostResult.value * Y;
  const baselineCost = baselineResult.value * Y;

  let sub: RubricScore;
  if (2 * candidateCost <= baselineCost) {
    sub = 5;
    nearBound = nearBoundaryCheck(2 * candidateCost, baselineCost);
  } else if (4 * candidateCost <= 3 * baselineCost) {
    sub = 4;
    nearBound = nearBoundaryCheck(4 * candidateCost, 3 * baselineCost);
  } else if (candidateCost <= baselineCost) {
    sub = 3;
    nearBound = nearBoundaryCheck(candidateCost, baselineCost);
  } else if (2 * candidateCost <= 3 * baselineCost) {
    sub = 2;
    nearBound = nearBoundaryCheck(2 * candidateCost, 3 * baselineCost);
  } else if (candidateCost <= 2 * baselineCost) {
    sub = 1;
    nearBound = nearBoundaryCheck(candidateCost, 2 * baselineCost);
  } else {
    sub = 0;
  }

  return { name: "totalCost", sub, nearBoundary: nearBound, paths };
}

function computeReversibilityLearning(oe: OptionEstimate): {
  name: "reversibilityLearning";
  sub: RubricScore;
  nearBoundary: boolean;
  paths: string[];
} {
  const sub = Math.floor(
    (oe.reversibility.score + oe.learningValue.score) / 2,
  ) as RubricScore;
  return {
    name: "reversibilityLearning",
    sub,
    nearBoundary: false,
    paths: [],
  };
}

export function rankCandidates(
  results: CandidateResult[],
): RankEntry[] {
  const eligible = results.filter(
    (r) => r.verdict === "eligible" && r.totalScore !== null,
  );
  const sorted = [...eligible].sort((a, b) => {
    const scoreDiff = b.totalScore! - a.totalScore!;
    if (scoreDiff !== 0) return scoreDiff;
    return (
      CANDIDATE_ORDER.indexOf(a.candidate) -
      CANDIDATE_ORDER.indexOf(b.candidate)
    );
  });
  return sorted.map((r, i) => ({
    rank: i + 1,
    candidate: r.candidate,
    totalScore: r.totalScore!,
  }));
}

export function scoreCandidateWithOverrides(
  candidate: ExecutionCandidate,
  ctx: ScoreContext,
  overrides?: {
    rubricOverrides?: Map<string, number>;
    costMode?: "low" | "high";
  },
): { totalScore: number; breakdown: ComponentScore[] } {
  if (!overrides) return scoreCandidate(candidate, ctx);

  const ta = ctx.taskAnalysis;
  const oe = ta.optionEstimates.find((o) => o.candidate === candidate)!;

  const modifiedOe = deepClone(oe);

  if (overrides.rubricOverrides) {
    for (const [path, newScore] of overrides.rubricOverrides) {
      applyRubricOverride(modifiedOe, ta, path, newScore);
    }
  }

  if (overrides.costMode) {
    if (overrides.costMode === "low") {
      modifiedOe.setupCost.base = deepClone(modifiedOe.setupCost.low);
      modifiedOe.runCost.base = deepClone(modifiedOe.runCost.low);
    } else {
      modifiedOe.setupCost.base = deepClone(modifiedOe.setupCost.high);
      modifiedOe.runCost.base = deepClone(modifiedOe.runCost.high);
    }
  }

  const modifiedTa = deepClone(ta);
  const idx = modifiedTa.optionEstimates.findIndex(
    (o: OptionEstimate) => o.candidate === candidate,
  );
  modifiedTa.optionEstimates[idx] = modifiedOe;

  const modifiedCtx: ScoreContext = { ...ctx, taskAnalysis: modifiedTa };
  return scoreCandidate(candidate, modifiedCtx);
}

function applyRubricOverride(
  oe: OptionEstimate,
  ta: TaskAnalysis,
  path: string,
  newScore: number,
): void {
  const clamped = clamp(0, 5, newScore) as RubricScore;
  if (path.includes("expectedQuality")) oe.expectedQuality.score = clamped;
  else if (path.includes("reversibility")) oe.reversibility.score = clamped;
  else if (path.includes("learningValue")) oe.learningValue.score = clamped;
}
