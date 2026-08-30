import { canonicalizeMoneyPerYear, computeFrequencyPerYear, checkCurrencyConsistency } from "./canonical.js";
import { RULE_SET_VERSION, VALID_RUBRIC_IDS, OWNER_ROLE_PATTERN, CANDIDATE_ORDER } from "./rules.js";
import type {
  DefinitionRef,
  OperatingConstraints,
  TaskAnalysis,
  ValidationIssue,
  WorkforcePlacementAnalysis,
} from "./types.js";
import type { WorkforceDefinition } from "../types.js";
import { validateWorkforceDefinition } from "../validate.js";

function issue(
  code: string,
  path: string,
  message: string,
  relatedIds: string[] = [],
): ValidationIssue {
  return { code, path, message, severity: "error", relatedIds };
}

export interface ValidateOptions {
  definitionDigest?: string;
}

export function validatePlacementAnalysis(
  definition: WorkforceDefinition,
  analysis: WorkforcePlacementAnalysis,
  options: ValidateOptions,
): { valid: boolean; issues: ValidationIssue[]; failClosedCodes: string[] } {
  const issues: ValidationIssue[] = [];
  const failClosedCodes: string[] = [];

  const m1Result = validateWorkforceDefinition(definition);
  if (!m1Result.valid) {
    failClosedCodes.push("M1_DEFINITION_INVALID");
    issues.push(
      issue(
        "M1_DEFINITION_INVALID",
        "/",
        "The M1 WorkforceDefinition has validation errors",
      ),
    );
  }

  if (!options.definitionDigest) {
    failClosedCodes.push("DEFINITION_DIGEST_MISSING");
    issues.push(
      issue(
        "DEFINITION_DIGEST_MISSING",
        "/definitionRef/contentDigest",
        "No definition digest was provided",
      ),
    );
  } else if (
    analysis.definitionRef.contentDigest !== options.definitionDigest
  ) {
    failClosedCodes.push("DEFINITION_DIGEST_MISMATCH");
    issues.push(
      issue(
        "DEFINITION_DIGEST_MISMATCH",
        "/definitionRef/contentDigest",
        `Expected digest ${options.definitionDigest} but got ${analysis.definitionRef.contentDigest}`,
      ),
    );
  }

  if (analysis.definitionRef.definitionId !== definition.definitionId) {
    failClosedCodes.push("DEFINITION_DIGEST_MISMATCH");
    issues.push(
      issue(
        "DEFINITION_DIGEST_MISMATCH",
        "/definitionRef/definitionId",
        `Definition id mismatch: expected ${definition.definitionId}`,
      ),
    );
  }

  if (analysis.ruleSetVersion !== RULE_SET_VERSION) {
    failClosedCodes.push("RULE_SET_VERSION_UNKNOWN");
    issues.push(
      issue(
        "RULE_SET_VERSION_UNKNOWN",
        "/ruleSetVersion",
        `Unrecognized rule set version: ${analysis.ruleSetVersion}`,
      ),
    );
  }

  validateRubricIds(analysis, issues, failClosedCodes);
  validateTaskScope(analysis, definition, issues, failClosedCodes);
  validateTaskAnalyses(analysis, definition, issues, failClosedCodes);
  validateHumanSelections(analysis, issues, failClosedCodes);

  issues.sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;
    return a.code.localeCompare(b.code);
  });

  const uniqueFailClosed = [...new Set(failClosedCodes)].sort();

  return {
    valid: issues.length === 0,
    issues,
    failClosedCodes: uniqueFailClosed,
  };
}

function validateRubricIds(
  analysis: WorkforcePlacementAnalysis,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  for (let i = 0; i < analysis.taskAnalyses.length; i++) {
    const ta = analysis.taskAnalyses[i]!;
    const base = `/taskAnalyses/${i}`;
    const wc = ta.workCharacteristics;
    const ratedFields: Array<{ path: string; rubricId: string }> = [
      { path: `${base}/workCharacteristics/repeatability`, rubricId: wc.repeatability.rubricId },
      { path: `${base}/workCharacteristics/digitality`, rubricId: wc.digitality.rubricId },
      { path: `${base}/workCharacteristics/exceptionRate`, rubricId: wc.exceptionRate.rubricId },
      { path: `${base}/workCharacteristics/judgmentEmpathy`, rubricId: wc.judgmentEmpathy.rubricId },
      { path: `${base}/workCharacteristics/specifiability`, rubricId: wc.specifiability.rubricId },
      { path: `${base}/currentState/qualityRecord`, rubricId: ta.currentState.qualityRecord.rubricId },
    ];
    for (let j = 0; j < ta.optionEstimates.length; j++) {
      const oe = ta.optionEstimates[j]!;
      const oeBase = `${base}/optionEstimates/${j}`;
      ratedFields.push(
        { path: `${oeBase}/expectedQuality`, rubricId: oe.expectedQuality.rubricId },
        { path: `${oeBase}/reversibility`, rubricId: oe.reversibility.rubricId },
        { path: `${oeBase}/learningValue`, rubricId: oe.learningValue.rubricId },
        { path: `${oeBase}/confidence`, rubricId: oe.confidence.rubricId },
      );
    }
    for (const { path, rubricId } of ratedFields) {
      if (!VALID_RUBRIC_IDS.has(rubricId)) {
        failClosedCodes.push("RULE_SET_VERSION_UNKNOWN");
        issues.push(
          issue("RULE_SET_VERSION_UNKNOWN", `${path}/rubricId`, `Unknown rubricId: ${rubricId}`),
        );
      }
    }

    for (let j = 0; j < ta.optionEstimates.length; j++) {
      const oe = ta.optionEstimates[j]!;
      const oeBase = `${base}/optionEstimates/${j}`;
      for (const rated of [oe.expectedQuality, oe.reversibility, oe.learningValue, oe.confidence]) {
        if (rated.score < 0 || rated.score > 5) {
          failClosedCodes.push("VALUE_OUT_OF_RANGE");
          issues.push(issue("VALUE_OUT_OF_RANGE", oeBase, `Score ${rated.score} out of range 0-5`));
        }
      }
    }
  }
}

function validateTaskScope(
  analysis: WorkforcePlacementAnalysis,
  definition: WorkforceDefinition,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  const defTaskIds = new Set(definition.tasks.map((t) => t.id));
  for (const tid of analysis.scopeTaskIds) {
    if (!defTaskIds.has(tid)) {
      failClosedCodes.push("TASK_OUT_OF_SCOPE");
      issues.push(
        issue("TASK_OUT_OF_SCOPE", "/scopeTaskIds", `Task ${tid} not in definition`),
      );
    }
  }

  const seenTaskIds = new Set<string>();
  for (let i = 0; i < analysis.taskAnalyses.length; i++) {
    const ta = analysis.taskAnalyses[i]!;
    if (!analysis.scopeTaskIds.includes(ta.taskId)) {
      failClosedCodes.push("TASK_OUT_OF_SCOPE");
      issues.push(
        issue("TASK_OUT_OF_SCOPE", `/taskAnalyses/${i}/taskId`, `Task ${ta.taskId} not in scopeTaskIds`),
      );
    }
    if (seenTaskIds.has(ta.taskId)) {
      failClosedCodes.push("TASK_ANALYSIS_DUPLICATE");
      issues.push(
        issue("TASK_ANALYSIS_DUPLICATE", `/taskAnalyses/${i}/taskId`, `Duplicate task analysis for ${ta.taskId}`),
      );
    }
    seenTaskIds.add(ta.taskId);
  }
}

function validateTaskAnalyses(
  analysis: WorkforcePlacementAnalysis,
  definition: WorkforceDefinition,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  for (let i = 0; i < analysis.taskAnalyses.length; i++) {
    const ta = analysis.taskAnalyses[i]!;
    const base = `/taskAnalyses/${i}`;

    if (
      ta.currentState.ownerRoleId !== null &&
      !OWNER_ROLE_PATTERN.test(ta.currentState.ownerRoleId)
    ) {
      failClosedCodes.push("OWNER_NOT_SYNTHETIC_ROLE");
      issues.push(
        issue(
          "OWNER_NOT_SYNTHETIC_ROLE",
          `${base}/currentState/ownerRoleId`,
          `ownerRoleId "${ta.currentState.ownerRoleId}" does not match pattern`,
        ),
      );
    }

    checkCriticalEvidence(ta, base, issues, failClosedCodes);
    checkCostBaseline(ta, analysis, base, issues, failClosedCodes);
    checkCurrencies(ta, base, issues, failClosedCodes);
    checkCostRanges(ta, analysis, base, issues, failClosedCodes);

    if (ta.optionEstimates.length !== 4) {
      failClosedCodes.push("ANALYSIS_SCHEMA_INVALID");
      issues.push(
        issue("ANALYSIS_SCHEMA_INVALID", `${base}/optionEstimates`, "Must have exactly 4 option estimates"),
      );
    }

    for (let j = 0; j < ta.optionEstimates.length; j++) {
      const oe = ta.optionEstimates[j]!;
      const expectedCandidate = CANDIDATE_ORDER[j];
      if (oe.candidate !== expectedCandidate) {
        failClosedCodes.push("ANALYSIS_SCHEMA_INVALID");
        issues.push(
          issue(
            "ANALYSIS_SCHEMA_INVALID",
            `${base}/optionEstimates/${j}/candidate`,
            `Expected ${expectedCandidate} but got ${oe.candidate}`,
          ),
        );
      }
    }
  }
}

function checkCriticalEvidence(
  ta: TaskAnalysis,
  base: string,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  const taskLevelInputs: Array<{ path: string; evidence: { status: string } }> = [];

  if (ta.demand.frequency.evidence)
    taskLevelInputs.push({ path: `${base}/demand/frequency`, evidence: ta.demand.frequency.evidence });
  if (ta.demand.volume.evidence)
    taskLevelInputs.push({ path: `${base}/demand/volume`, evidence: ta.demand.volume.evidence });
  if (ta.demand.slaTurnaround.evidence)
    taskLevelInputs.push({ path: `${base}/demand/slaTurnaround`, evidence: ta.demand.slaTurnaround.evidence });
  if (ta.currentState.costPerPeriod.evidence)
    taskLevelInputs.push({ path: `${base}/currentState/costPerPeriod`, evidence: ta.currentState.costPerPeriod.evidence });
  if (ta.currentState.qualityRecord.evidence)
    taskLevelInputs.push({ path: `${base}/currentState/qualityRecord`, evidence: ta.currentState.qualityRecord.evidence });

  for (const ev of ta.operatingConstraints.evidence) {
    taskLevelInputs.push({ path: `${base}/operatingConstraints`, evidence: ev });
  }

  for (const input of taskLevelInputs) {
    if (input.evidence.status === "unverified") {
      failClosedCodes.push("CRITICAL_EVIDENCE_UNVERIFIED");
      issues.push(
        issue(
          "CRITICAL_EVIDENCE_UNVERIFIED",
          `${input.path}/evidence/status`,
          "Task-level input has unverified evidence",
        ),
      );
      return;
    }
  }
}

function checkCostBaseline(
  ta: TaskAnalysis,
  analysis: WorkforcePlacementAnalysis,
  base: string,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  const cost = ta.currentState.costPerPeriod;
  if (cost.amount === null || cost.amount === 0) {
    const freqResult = computeFrequencyPerYear(ta.demand.frequency);
    const frequencyPerYear = freqResult.ok ? freqResult.value : null;
    const canonical = canonicalizeMoneyPerYear(cost, frequencyPerYear);
    if (!canonical.ok || canonical.value === 0 || cost.amount === null) {
      failClosedCodes.push("MISSING_COST_BASELINE");
      issues.push(
        issue(
          "MISSING_COST_BASELINE",
          `${base}/currentState/costPerPeriod/amount`,
          "Cost baseline is missing or zero",
        ),
      );
    }
  }
}

function checkCurrencies(
  ta: TaskAnalysis,
  base: string,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  const currencies: string[] = [ta.currentState.costPerPeriod.currency];
  for (const oe of ta.optionEstimates) {
    currencies.push(
      oe.setupCost.low.currency,
      oe.setupCost.base.currency,
      oe.setupCost.high.currency,
      oe.runCost.low.currency,
      oe.runCost.base.currency,
      oe.runCost.high.currency,
    );
  }
  if (!checkCurrencyConsistency(currencies)) {
    failClosedCodes.push("UNIT_INCONSISTENT");
    issues.push(
      issue("UNIT_INCONSISTENT", base, "Mixed currencies in task analysis"),
    );
  }
}

function checkCostRanges(
  ta: TaskAnalysis,
  analysis: WorkforcePlacementAnalysis,
  base: string,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  const freqResult = computeFrequencyPerYear(ta.demand.frequency);
  const frequencyPerYear = freqResult.ok ? freqResult.value : null;

  for (let j = 0; j < ta.optionEstimates.length; j++) {
    const oe = ta.optionEstimates[j]!;
    for (const costType of ["setupCost", "runCost"] as const) {
      const ce = oe[costType];
      const lowR = canonicalizeMoneyPerYear(ce.low, frequencyPerYear);
      const baseR = canonicalizeMoneyPerYear(ce.base, frequencyPerYear);
      const highR = canonicalizeMoneyPerYear(ce.high, frequencyPerYear);
      if (lowR.ok && baseR.ok && highR.ok) {
        if (lowR.value > baseR.value || baseR.value > highR.value) {
          failClosedCodes.push("COST_RANGE_INVERTED");
          issues.push(
            issue(
              "COST_RANGE_INVERTED",
              `${base}/optionEstimates/${j}/${costType}`,
              "Cost range inverted: not low <= base <= high",
            ),
          );
        }
      }
    }
  }
}

function validateHumanSelections(
  analysis: WorkforcePlacementAnalysis,
  issues: ValidationIssue[],
  failClosedCodes: string[],
): void {
  for (let i = 0; i < analysis.humanSelections.length; i++) {
    const sel = analysis.humanSelections[i]!;
    const base = `/humanSelections/${i}`;

    if (sel.approval.actionType !== "placement_commit") {
      failClosedCodes.push("RISK_APPROVAL_INCONSISTENT");
      issues.push(
        issue(
          "RISK_APPROVAL_INCONSISTENT",
          `${base}/approval/actionType`,
          "Human selection approval must be placement_commit",
        ),
      );
    }

    if (sel.approval.state !== "approved") {
      failClosedCodes.push("RISK_APPROVAL_INCONSISTENT");
      issues.push(
        issue(
          "RISK_APPROVAL_INCONSISTENT",
          `${base}/approval/state`,
          "Only an approved placement_commit card can confirm execution type",
        ),
      );
    }

    if ((sel.approval.state as string) === "executed") {
      failClosedCodes.push("RISK_APPROVAL_INCONSISTENT");
      issues.push(
        issue(
          "RISK_APPROVAL_INCONSISTENT",
          `${base}/approval/state`,
          "M2 does not accept executed approval state",
        ),
      );
    }
  }
}
