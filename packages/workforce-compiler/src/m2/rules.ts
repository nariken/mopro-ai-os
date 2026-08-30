import type { ComponentName, ExecutionCandidate, RubricScore } from "./types.js";

export const RULE_SET_VERSION = "wc-m2-rules/1.0.0" as const;

export const CANDIDATE_ORDER: readonly ExecutionCandidate[] = [
  "ai",
  "existing_staff",
  "hire",
  "outsource",
] as const;

export const MIN_RECOMMENDATION_MARGIN = 5;

export const PERIOD_FACTORS_PER_YEAR: Record<string, number> = {
  day: 365,
  week: 52,
  month: 12,
  quarter: 4,
  year: 1,
};

export const MINUTES_PER_YEAR_24X7 = 365 * 24 * 60; // 525600

export const COMPONENT_WEIGHTS: Record<ComponentName, number> = {
  capability: 35,
  capacityTime: 20,
  qualityRisk: 20,
  totalCost: 15,
  reversibilityLearning: 10,
};

export const COMPONENT_ORDER: readonly ComponentName[] = [
  "capability",
  "capacityTime",
  "qualityRisk",
  "totalCost",
  "reversibilityLearning",
] as const;

export const POINTS_PER_STEP: Record<ComponentName, number> = {
  capability: 7,
  capacityTime: 4,
  qualityRisk: 4,
  totalCost: 3,
  reversibilityLearning: 2,
};

export function skillFitBase(maxGap: number): RubricScore {
  if (maxGap === 0) return 5;
  if (maxGap === 1) return 4;
  if (maxGap === 2) return 2;
  if (maxGap === 3) return 1;
  return 0;
}

export function aiShapeAdjust(shape: number): number {
  if (shape >= 20) return 1;
  if (shape >= 13) return 0;
  if (shape >= 7) return -1;
  return -2;
}

export function outsourceShapeAdjust(shape: number): number {
  if (shape >= 12) return 1;
  if (shape >= 7) return 0;
  if (shape >= 4) return -1;
  return -2;
}

export function riskPenalty(level: string): number {
  if (level === "critical") return 2;
  if (level === "high") return 1;
  return 0;
}

export const VALID_RUBRIC_IDS = new Set([
  "rubric.repeatability/1.0.0",
  "rubric.digitality/1.0.0",
  "rubric.exceptionRate/1.0.0",
  "rubric.judgmentEmpathy/1.0.0",
  "rubric.specifiability/1.0.0",
  "rubric.expectedQuality/1.0.0",
  "rubric.reversibility/1.0.0",
  "rubric.learningValue/1.0.0",
  "rubric.confidence/1.0.0",
  "rubric.qualityRecord/1.0.0",
]);

export const SCOPE_STATEMENT =
  "This approval records a placement decision only. It does not authorize publishing a job post, contacting a candidate, awarding a contract, hiring, committing budget, connecting an account, granting an AI agent external write access, or ingesting real data. Each of those is a separate approval.";

export const OWNER_ROLE_PATTERN = /^(role|profile)-[a-z0-9-]+$/;
