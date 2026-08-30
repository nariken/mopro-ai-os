import { MIN_RECOMMENDATION_MARGIN, CANDIDATE_ORDER } from "./rules.js";
import type {
  CandidateResult,
  Clarification,
  Decision,
  ExecutionCandidate,
  RankEntry,
} from "./types.js";

export interface DecisionOutput {
  decision: Decision;
  reasonCodes: string[];
  requiredClarifications: Clarification[];
}

export function makeDecision(
  candidates: CandidateResult[],
  ranking: RankEntry[],
  failClosedCodes: string[],
  taskId: string,
): DecisionOutput {
  const clarifications: Clarification[] = [];

  if (failClosedCodes.length > 0) {
    for (const code of failClosedCodes) {
      clarifications.push(
        makeClarification(code, taskId),
      );
    }
    clarifications.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
    return {
      decision: "undecided",
      reasonCodes: [...failClosedCodes].sort(),
      requiredClarifications: clarifications,
    };
  }

  const eligibleCount = candidates.filter(
    (c) => c.verdict === "eligible",
  ).length;
  const unknownCount = candidates.filter(
    (c) => c.verdict === "unknown",
  ).length;

  if (eligibleCount === 0) {
    const codes: string[] = ["NO_ELIGIBLE_CANDIDATE"];
    if (unknownCount === CANDIDATE_ORDER.length) {
      codes.push("ALL_CANDIDATES_UNKNOWN");
    }
    codes.sort();
    for (const code of codes) {
      clarifications.push(makeClarification(code, taskId));
    }
    clarifications.sort((a, b) => a.targetPath.localeCompare(b.targetPath));
    return {
      decision: "undecided",
      reasonCodes: codes,
      requiredClarifications: clarifications,
    };
  }

  if (eligibleCount === 1 && unknownCount === 0) {
    return {
      decision: "recommended",
      reasonCodes: [],
      requiredClarifications: [],
    };
  }

  if (eligibleCount === 1 && unknownCount > 0) {
    return {
      decision: "human_choice",
      reasonCodes: ["SOLE_ELIGIBLE_WITH_UNKNOWN_RIVALS"],
      requiredClarifications: [],
    };
  }

  if (ranking.length >= 2) {
    const margin = ranking[0]!.totalScore - ranking[1]!.totalScore;
    if (margin >= MIN_RECOMMENDATION_MARGIN) {
      return {
        decision: "recommended",
        reasonCodes: [],
        requiredClarifications: [],
      };
    }
  }

  return {
    decision: "human_choice",
    reasonCodes: ["MARGIN_BELOW_THRESHOLD"],
    requiredClarifications: [],
  };
}

function makeClarification(code: string, taskId: string): Clarification {
  const clarificationMap: Record<
    string,
    { question: string; path: string; evidence: string[] }
  > = {
    M1_DEFINITION_INVALID: {
      question: "The M1 definition has validation errors. Please fix them.",
      path: `/`,
      evidence: ["Corrected M1 WorkforceDefinition"],
    },
    DEFINITION_DIGEST_MISSING: {
      question: "No definition digest was provided. Please supply the content digest.",
      path: `/definitionRef/contentDigest`,
      evidence: ["SHA-256 digest of the M1 definition"],
    },
    DEFINITION_DIGEST_MISMATCH: {
      question:
        "The analysis was written against a different revision of the definition. Please update.",
      path: `/definitionRef/contentDigest`,
      evidence: ["Updated analysis matching the current definition"],
    },
    ANALYSIS_SCHEMA_INVALID: {
      question: "The analysis document has schema errors. Please fix them.",
      path: `/`,
      evidence: ["Schema-valid WorkforcePlacementAnalysis"],
    },
    RULE_SET_VERSION_UNKNOWN: {
      question: "The rule set version is not recognized. Please use a supported version.",
      path: `/ruleSetVersion`,
      evidence: ["Analysis with ruleSetVersion wc-m2-rules/1.0.0"],
    },
    CRITICAL_EVIDENCE_UNVERIFIED: {
      question:
        "A task-level input has unverified evidence. Please verify or provide assumed evidence.",
      path: `/taskAnalyses`,
      evidence: ["Evidence with status assumed or observed"],
    },
    MISSING_COST_BASELINE: {
      question:
        "The current cost baseline is missing or zero. Please provide a cost baseline.",
      path: `/taskAnalyses`,
      evidence: ["Non-null, non-zero costPerPeriod amount"],
    },
    NO_ELIGIBLE_CANDIDATE: {
      question: "No candidate is eligible. Please review gate conditions.",
      path: `/taskAnalyses`,
      evidence: ["Updated estimates removing blocking conditions"],
    },
    ALL_CANDIDATES_UNKNOWN: {
      question: "All candidates have unknown status. Please provide missing inputs.",
      path: `/taskAnalyses`,
      evidence: ["Complete option estimates for at least one candidate"],
    },
    UNIT_INCONSISTENT: {
      question: "Mixed currencies detected. Please use a single currency.",
      path: `/taskAnalyses`,
      evidence: ["All Money fields with consistent currency"],
    },
    UNIT_NOT_CANONICALIZABLE: {
      question: "A value cannot be converted to canonical units. Please fix the period/unit.",
      path: `/taskAnalyses`,
      evidence: ["Values with supported period and unit combinations"],
    },
    VALUE_OUT_OF_RANGE: {
      question: "A rubric score or total is out of range. Please fix.",
      path: `/taskAnalyses`,
      evidence: ["Scores in 0-5, totals in 0-100"],
    },
    COST_RANGE_INVERTED: {
      question: "Cost range is inverted (low > base or base > high). Please fix.",
      path: `/taskAnalyses`,
      evidence: ["Corrected cost estimates with low <= base <= high"],
    },
    FORBIDDEN_CANDIDATE_RANKED_FIRST: {
      question:
        "A forbidden candidate is ranked first. Please review constraints or estimates.",
      path: `/taskAnalyses`,
      evidence: ["Updated forbidden list or estimates"],
    },
    RISK_APPROVAL_INCONSISTENT: {
      question: "Approval card is missing or invalid for the selected candidate.",
      path: `/humanSelections`,
      evidence: ["Valid placement_commit approval card"],
    },
    NONDETERMINISTIC_RESULT: {
      question: "The evaluation produced different results on re-run. This is a bug.",
      path: `/`,
      evidence: ["Deterministic evaluation"],
    },
    NO_PLACEMENT_ANALYSIS: {
      question: "No placement analysis was provided.",
      path: `/`,
      evidence: ["A WorkforcePlacementAnalysis document"],
    },
    TASK_OUT_OF_SCOPE: {
      question: "A task analysis references a task not in scopeTaskIds.",
      path: `/taskAnalyses`,
      evidence: ["Corrected scopeTaskIds or taskAnalyses"],
    },
    TASK_ANALYSIS_DUPLICATE: {
      question: "Duplicate task analysis entries found.",
      path: `/taskAnalyses`,
      evidence: ["One TaskAnalysis per task"],
    },
    OWNER_NOT_SYNTHETIC_ROLE: {
      question:
        "ownerRoleId must match role- or profile- pattern.",
      path: `/taskAnalyses`,
      evidence: ["ownerRoleId matching ^(role|profile)-[a-z0-9-]+$"],
    },
  };

  const info = clarificationMap[code] ?? {
    question: `Condition ${code} must be resolved.`,
    path: `/taskAnalyses`,
    evidence: ["Corrected input"],
  };

  return {
    id: `clarify-${taskId}-${code.toLowerCase().replace(/_/g, "-")}`,
    targetPath: info.path,
    question: info.question,
    whyBlocking: code,
    acceptableEvidence: info.evidence,
  };
}
