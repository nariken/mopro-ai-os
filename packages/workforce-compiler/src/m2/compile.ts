import { jcsCanonical } from "./canonical.js";
import { CANDIDATE_ORDER, RULE_SET_VERSION } from "./rules.js";
import { evaluateGate, type GateContext } from "./gate.js";
import { scoreCandidate, rankCandidates, type ScoreContext } from "./score.js";
import { computeSensitivity } from "./sensitivity.js";
import { makeDecision } from "./decide.js";
import { generateArtifacts } from "./artifacts.js";
import {
  validatePlacementAnalysis,
  type ValidateOptions,
} from "./validate.js";
import type {
  CandidateResult,
  EvidenceRef,
  PlacementResult,
  TaskPlacementResult,
  WorkforcePlacementAnalysis,
} from "./types.js";
import type { WorkforceDefinition } from "../types.js";

export interface CompileInput {
  definition: WorkforceDefinition;
  analysis: WorkforcePlacementAnalysis | null;
  definitionDigest?: string;
}

export function compilePlacement(input: CompileInput): PlacementResult {
  const { definition, analysis, definitionDigest } = input;

  if (analysis === null || analysis === undefined) {
    return makeUndecidedResult(definition, ["NO_PLACEMENT_ANALYSIS"]);
  }

  const result1 = evaluateOnce(definition, analysis, definitionDigest);
  const result2 = evaluateOnce(definition, analysis, definitionDigest);

  const jcs1 = jcsCanonical(result1);
  const jcs2 = jcsCanonical(result2);

  if (jcs1 !== jcs2) {
    return makeUndecidedResult(
      definition,
      ["NONDETERMINISTIC_RESULT"],
      analysis,
    );
  }

  return result1;
}

function evaluateOnce(
  definition: WorkforceDefinition,
  analysis: WorkforcePlacementAnalysis,
  definitionDigest?: string,
): PlacementResult {
  const opts: ValidateOptions = { definitionDigest };
  const validation = validatePlacementAnalysis(definition, analysis, opts);

  if (validation.failClosedCodes.length > 0) {
    return {
      schemaVersion: "2.0.0",
      ruleSetVersion: RULE_SET_VERSION,
      analysisId: analysis.analysisId,
      generatedAt: analysis.generatedAt,
      definitionRef: analysis.definitionRef,
      valid: false,
      issues: validation.issues,
      tasks: analysis.taskAnalyses.map((ta) => {
        const decision = makeDecision(
          CANDIDATE_ORDER.map((c) => ({
            candidate: c,
            verdict: "unknown" as const,
            reasonCodes: [],
            totalScore: null,
            breakdown: null,
          })),
          [],
          validation.failClosedCodes,
          ta.taskId,
        );
        return {
          taskId: ta.taskId,
          decision: decision.decision,
          decisionReasonCodes: decision.reasonCodes,
          candidates: CANDIDATE_ORDER.map((c) => ({
            candidate: c,
            verdict: "unknown" as const,
            reasonCodes: [],
            totalScore: null,
            breakdown: null,
          })),
          ranking: [],
          supportingEvidence: [],
          counterEvidence: ta.counterEvidence.sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
          assumptions: [],
          missingEvidence: [],
          sensitivity: [],
          requiredClarifications: decision.requiredClarifications,
          confirmedExecutionType: null,
          approval: null,
          artifacts: [],
        };
      }),
    };
  }

  const tasks: TaskPlacementResult[] = [];

  for (let i = 0; i < analysis.taskAnalyses.length; i++) {
    const ta = analysis.taskAnalyses[i]!;
    const defTask = definition.tasks.find((t) => t.id === ta.taskId);
    const requiredSkillIds = defTask
      ? defTask.requiredSkills.map((s) => s.skillId)
      : [];
    const requiredSkillLevels = new Map(
      defTask?.requiredSkills.map((s) => [s.skillId, s.requiredLevel]) ?? [],
    );

    const gateCtx: GateContext = {
      analysis,
      taskAnalysis: ta,
      taskIndex: i,
      requiredSkillIds,
      requiredSkillLevels,
    };

    let candidates = evaluateGate(gateCtx);

    const scoreCtx: ScoreContext = {
      analysis,
      taskAnalysis: ta,
      requiredSkillIds,
      requiredSkillLevels,
      taskRiskLevel: defTask?.risk.level ?? "medium",
      taskIndex: i,
    };

    const taskFailClosed: string[] = [];

    checkForbiddenRankedFirst(candidates, ta, scoreCtx, taskFailClosed);

    candidates = candidates.map((cr) => {
      if (cr.verdict !== "eligible") return cr;
      const scored = scoreCandidate(cr.candidate, scoreCtx);
      return {
        ...cr,
        totalScore: scored.totalScore,
        breakdown: scored.breakdown,
      };
    });

    const ranking = rankCandidates(candidates);

    if (
      ranking.length > 0 &&
      ta.operatingConstraints.forbiddenExecutionTypes.includes(
        ranking[0]!.candidate,
      )
    ) {
      taskFailClosed.push("FORBIDDEN_CANDIDATE_RANKED_FIRST");
    }

    const decision = makeDecision(
      candidates,
      ranking,
      taskFailClosed,
      ta.taskId,
    );

    const sensitivity =
      decision.decision !== "undecided"
        ? computeSensitivity(candidates, scoreCtx)
        : [];

    const artResult = generateArtifacts(
      decision.decision,
      candidates,
      ranking,
      ta,
      analysis,
      definition,
      analysis.humanSelections,
      ta.counterEvidence,
    );

    const supportingEvidence = collectSupportingEvidence(
      ranking,
      ta,
    );
    const assumptions = collectAssumptions(ta);
    const missingEvidence = collectMissingEvidence(candidates, ta, i);

    tasks.push({
      taskId: ta.taskId,
      decision: decision.decision,
      decisionReasonCodes: decision.reasonCodes,
      candidates,
      ranking,
      supportingEvidence,
      counterEvidence: ta.counterEvidence.sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      assumptions,
      missingEvidence,
      sensitivity,
      requiredClarifications: decision.requiredClarifications,
      confirmedExecutionType: artResult.confirmedExecutionType,
      approval: artResult.approval,
      artifacts: artResult.artifacts,
    });
  }

  tasks.sort((a, b) => a.taskId.localeCompare(b.taskId));

  return {
    schemaVersion: "2.0.0",
    ruleSetVersion: RULE_SET_VERSION,
    analysisId: analysis.analysisId,
    generatedAt: analysis.generatedAt,
    definitionRef: analysis.definitionRef,
    valid: validation.valid,
    issues: validation.issues,
    tasks,
  };
}

function checkForbiddenRankedFirst(
  candidates: CandidateResult[],
  ta: import("./types.js").TaskAnalysis,
  scoreCtx: ScoreContext,
  failClosed: string[],
): void {
  // Checked after scoring in the main flow
}

function makeUndecidedResult(
  definition: WorkforceDefinition,
  codes: string[],
  analysis?: WorkforcePlacementAnalysis,
): PlacementResult {
  const decision = makeDecision(
    CANDIDATE_ORDER.map((c) => ({
      candidate: c,
      verdict: "unknown" as const,
      reasonCodes: [],
      totalScore: null,
      breakdown: null,
    })),
    [],
    codes,
    "unknown",
  );

  return {
    schemaVersion: "2.0.0",
    ruleSetVersion: RULE_SET_VERSION,
    analysisId: analysis?.analysisId ?? "",
    generatedAt: analysis?.generatedAt ?? "",
    definitionRef: analysis?.definitionRef ?? {
      definitionId: definition.definitionId,
      schemaVersion: "1.0.0",
      contentDigest: "",
    },
    valid: false,
    issues: codes.map((c) => ({
      code: c,
      path: "/",
      message: c,
      severity: "error" as const,
      relatedIds: [],
    })),
    tasks: [],
  };
}

function collectSupportingEvidence(
  ranking: import("./types.js").RankEntry[],
  ta: import("./types.js").TaskAnalysis,
): EvidenceRef[] {
  if (ranking.length === 0) return [];
  const rank1 = ranking[0]!;
  const oe = ta.optionEstimates.find(
    (o) => o.candidate === rank1.candidate,
  );
  if (!oe) return [];
  return [...oe.evidence].sort((a, b) => a.id.localeCompare(b.id));
}

function collectAssumptions(
  ta: import("./types.js").TaskAnalysis,
): EvidenceRef[] {
  const assumptions: EvidenceRef[] = [];
  const seen = new Set<string>();

  const addEvidence = (ev: EvidenceRef) => {
    if (ev.status === "assumed" && !seen.has(ev.id)) {
      seen.add(ev.id);
      assumptions.push(ev);
    }
  };

  addEvidence(ta.demand.frequency.evidence);
  addEvidence(ta.demand.volume.evidence);
  addEvidence(ta.demand.variabilityPct.evidence);
  addEvidence(ta.demand.peakVolume.evidence);
  addEvidence(ta.demand.slaTurnaround.evidence);
  addEvidence(ta.currentState.costPerPeriod.evidence);
  addEvidence(ta.currentState.qualityRecord.evidence);
  addEvidence(ta.currentState.capacity.evidence);
  addEvidence(ta.currentState.timeSpent.evidence);
  for (const ev of ta.currentState.evidence) addEvidence(ev);
  for (const sp of ta.currentState.skillProfile) addEvidence(sp.evidence);
  for (const ev of ta.operatingConstraints.evidence) addEvidence(ev);
  for (const oe of ta.optionEstimates) {
    for (const ev of oe.evidence) addEvidence(ev);
    addEvidence(oe.setupTime.evidence);
    addEvidence(oe.setupCost.base.evidence);
    addEvidence(oe.runTime.evidence);
    addEvidence(oe.runCost.base.evidence);
    addEvidence(oe.availableCapacity.evidence);
    addEvidence(oe.learningTime.evidence);
    addEvidence(oe.expectedQuality.evidence);
    addEvidence(oe.reversibility.evidence);
    addEvidence(oe.learningValue.evidence);
    addEvidence(oe.confidence.evidence);
    for (const sk of oe.attainableSkills) addEvidence(sk.evidence);
  }

  return assumptions.sort((a, b) => a.id.localeCompare(b.id));
}

function collectMissingEvidence(
  candidates: CandidateResult[],
  ta: import("./types.js").TaskAnalysis,
  taskIndex: number,
): import("./types.js").Clarification[] {
  const clarifications: import("./types.js").Clarification[] = [];
  for (const cr of candidates) {
    if (cr.verdict === "unknown") {
      const oe = ta.optionEstimates.find(
        (o) => o.candidate === cr.candidate,
      );
      if (!oe) continue;
      for (const code of cr.reasonCodes) {
        if (code === "FG_INPUT_MISSING" || code === "FG_EVIDENCE_UNVERIFIED") {
          clarifications.push({
            id: `missing-${ta.taskId}-${cr.candidate}-${code.toLowerCase().replace(/_/g, "-")}`,
            targetPath: `/taskAnalyses/${taskIndex}/optionEstimates`,
            question: `Candidate ${cr.candidate} has ${code === "FG_INPUT_MISSING" ? "missing inputs" : "unverified evidence"}`,
            whyBlocking: code,
            acceptableEvidence: ["Complete and verified option estimate"],
          });
        }
      }
    }
  }
  return clarifications.sort((a, b) =>
    a.targetPath.localeCompare(b.targetPath),
  );
}
