import { RULE_SET_VERSION, SCOPE_STATEMENT } from "./rules.js";
import type {
  AiAgentSpecBody,
  CandidateResult,
  Clarification,
  CounterEvidence,
  DraftArtifact,
  ExecutionCandidate,
  HumanSelection,
  JobDescriptionBody,
  M2ApprovalGate,
  OptionEstimate,
  OutsourcingSowBody,
  RankEntry,
  RubricScore,
  SkillGapBody,
  TaskAnalysis,
  WorkforcePlacementAnalysis,
} from "./types.js";
import type { Task, WorkforceDefinition } from "../types.js";

export function generateArtifacts(
  decision: string,
  candidates: CandidateResult[],
  ranking: RankEntry[],
  ta: TaskAnalysis,
  analysis: WorkforcePlacementAnalysis,
  definition: WorkforceDefinition,
  humanSelections: HumanSelection[],
  counterEvidence: CounterEvidence[],
): {
  artifacts: DraftArtifact[];
  confirmedExecutionType: ExecutionCandidate | null;
  approval: M2ApprovalGate | null;
} {
  if (decision === "undecided") {
    return { artifacts: [], confirmedExecutionType: null, approval: null };
  }

  const defTask = definition.tasks.find((t) => t.id === ta.taskId);
  const skillIds = defTask
    ? defTask.requiredSkills.map((s) => s.skillId)
    : [];
  const artifacts: DraftArtifact[] = [];

  const eligible = candidates.filter((c) => c.verdict === "eligible");
  for (const cr of eligible) {
    const oe = ta.optionEstimates.find((o) => o.candidate === cr.candidate);
    if (!oe) continue;
    artifacts.push(
      buildSkillGap(cr.candidate, ta, oe, analysis, defTask, skillIds),
    );
  }

  const selection = humanSelections.find((s) => s.taskId === ta.taskId);
  let confirmedExecutionType: ExecutionCandidate | null = null;
  let approval: M2ApprovalGate | null = null;

  if (selection?.approval.state === "approved") {
    confirmedExecutionType = selection.selectedExecutionType;
    const candidateResult = candidates.find(
      (c) => c.candidate === selection.selectedExecutionType,
    );
    const runnerUpEntry =
      ranking.length >= 2 ? ranking[1] : null;

    approval = buildApproval(
      selection,
      candidateResult!,
      runnerUpEntry,
      ta,
      analysis,
      counterEvidence,
      defTask,
    );

    const confirmedOe = ta.optionEstimates.find(
      (o) => o.candidate === confirmedExecutionType!,
    );
    if (confirmedOe && defTask) {
      if (confirmedExecutionType === "ai") {
        artifacts.push(
          buildAiAgentSpec(ta, confirmedOe, analysis, defTask, skillIds),
        );
      } else if (
        confirmedExecutionType === "existing_staff" ||
        confirmedExecutionType === "hire"
      ) {
        artifacts.push(
          buildJobDescription(
            confirmedExecutionType,
            ta,
            confirmedOe,
            analysis,
            defTask,
            skillIds,
            artifacts,
          ),
        );
      } else if (confirmedExecutionType === "outsource") {
        artifacts.push(
          buildOutsourcingSow(ta, confirmedOe, analysis, defTask, skillIds),
        );
      }
    }
  }

  artifacts.sort((a, b) => {
    const typeCmp = a.artifactType.localeCompare(b.artifactType);
    if (typeCmp !== 0) return typeCmp;
    return a.id.localeCompare(b.id);
  });

  return { artifacts, confirmedExecutionType, approval };
}

function buildSkillGap(
  candidate: ExecutionCandidate,
  ta: TaskAnalysis,
  oe: OptionEstimate,
  analysis: WorkforcePlacementAnalysis,
  defTask: Task | undefined,
  skillIds: string[],
): DraftArtifact {
  const gaps: SkillGapBody["gaps"] = [];
  const requiredSkills = defTask?.requiredSkills ?? [];
  let hasBlocking = false;

  for (const rs of requiredSkills) {
    const attained = oe.attainableSkills.find(
      (s) => s.skillId === rs.skillId,
    );
    const currentLevel = attained?.attainedLevel ?? null;
    const delta =
      currentLevel !== null
        ? Math.max(0, rs.requiredLevel - currentLevel)
        : rs.requiredLevel;
    let severity: "none" | "minor" | "material" | "blocking";
    if (delta === 0) severity = "none";
    else if (delta === 1) severity = "minor";
    else if (delta === 2) severity = "material";
    else {
      severity = "blocking";
      hasBlocking = true;
    }

    gaps.push({
      skillId: rs.skillId,
      requiredLevel: rs.requiredLevel,
      currentLevel,
      delta,
      severity,
      learningTimeRange: {
        low: { value: 0, unit: "minute", period: "year", evidence: oe.learningTime.evidence },
        base: oe.learningTime,
        high: { value: (oe.learningTime.value ?? 0) * 2, unit: "minute", period: "year", evidence: oe.learningTime.evidence },
      },
      learningTimeFormula: `Based on candidate ${candidate} learning time estimate`,
      verificationMethod: "Skill assessment after learning period",
      evidence: attained?.evidence ?? oe.evidence[0]!,
    });
  }

  const readiness: SkillGapBody["readiness"] = hasBlocking
    ? "not_ready"
    : gaps.some((g) => g.severity !== "none")
      ? "conditional"
      : "ready";

  const roleRef = ta.currentState.ownerRoleId;
  const granularity = roleRef?.startsWith("profile-")
    ? ("profile_level" as const)
    : ("role_level" as const);

  return {
    id: `artifact-skill-gap-${ta.taskId}-${candidate}`,
    artifactType: "skill_gap",
    status: "draft",
    deliveryChannel: "local_only",
    taskIds: [ta.taskId],
    skillIds,
    candidate,
    ruleSetVersion: RULE_SET_VERSION,
    generatedAt: analysis.generatedAt,
    evidenceRefs: oe.evidence.slice(0, 3),
    unresolved: [],
    body: { roleRef, granularity, gaps, readiness },
  };
}

function buildAiAgentSpec(
  ta: TaskAnalysis,
  oe: OptionEstimate,
  analysis: WorkforcePlacementAnalysis,
  defTask: Task,
  skillIds: string[],
): DraftArtifact {
  const body: AiAgentSpecBody = {
    role: defTask.name,
    purpose: defTask.purpose,
    taskIds: [ta.taskId],
    inputs: defTask.inputs,
    outputs: defTask.outputs,
    skillIds,
    contextRefs: [],
    allowedTools: [],
    forbiddenTools: [],
    authority: defTask.authority,
    approvalGates: ["placement_commit"],
    qualityStandard: defTask.qualityStandard,
    kpis: defTask.kpi,
    failureModes: [],
    stopConditions: [],
    escalationPath: "Human review required",
  };

  return {
    id: `artifact-ai-agent-spec-${ta.taskId}`,
    artifactType: "ai_agent_spec",
    status: "draft",
    deliveryChannel: "local_only",
    taskIds: [ta.taskId],
    skillIds,
    candidate: "ai",
    ruleSetVersion: RULE_SET_VERSION,
    generatedAt: analysis.generatedAt,
    evidenceRefs: oe.evidence.slice(0, 3),
    unresolved: [],
    body,
  };
}

function buildJobDescription(
  candidate: "existing_staff" | "hire",
  ta: TaskAnalysis,
  oe: OptionEstimate,
  analysis: WorkforcePlacementAnalysis,
  defTask: Task,
  skillIds: string[],
  existingArtifacts: DraftArtifact[],
): DraftArtifact {
  const jdMode =
    candidate === "existing_staff"
      ? ("role_assignment_draft" as const)
      : ("hiring_draft" as const);

  const skillGap = existingArtifacts.find(
    (a) =>
      a.artifactType === "skill_gap" && a.candidate === candidate,
  );

  const body: JobDescriptionBody = {
    jdMode,
    purpose: defTask.purpose,
    responsibilities: defTask.outputs,
    taskIds: [ta.taskId],
    requiredSkills: defTask.requiredSkills,
    preferredSkills: [],
    authority: defTask.authority,
    approvalGates: ["placement_commit"],
    kpis: defTask.kpi,
    qualityStandard: defTask.qualityStandard,
    capacity: oe.availableCapacity,
    constraints: ta.operatingConstraints.legalConstraints,
    skillGapArtifactId: skillGap?.id ?? "",
  };

  return {
    id: `artifact-jd-${ta.taskId}-${candidate}`,
    artifactType: "job_description",
    status: "draft",
    deliveryChannel: "local_only",
    taskIds: [ta.taskId],
    skillIds,
    candidate,
    ruleSetVersion: RULE_SET_VERSION,
    generatedAt: analysis.generatedAt,
    evidenceRefs: oe.evidence.slice(0, 3),
    unresolved: [],
    body,
  };
}

function buildOutsourcingSow(
  ta: TaskAnalysis,
  oe: OptionEstimate,
  analysis: WorkforcePlacementAnalysis,
  defTask: Task,
  skillIds: string[],
): DraftArtifact {
  const body: OutsourcingSowBody = {
    scope: defTask.purpose,
    taskIds: [ta.taskId],
    deliverables: defTask.outputs,
    sla: defTask.kpi,
    kpis: defTask.kpi,
    acceptanceCriteria: defTask.qualityStandard,
    requiredEvidence: [],
    clientDependencies: defTask.inputs,
    dataBoundary: `Data sensitivity: ${ta.operatingConstraints.dataSensitivity}`,
    accessBoundary: "Local only; no external system access",
    approvalGates: ["placement_commit"],
    changeControl: "Changes require Human Approval",
    rollback: "Terminate contract and reassign",
    terminationConditions: "Quality below acceptance criteria for two consecutive periods",
    costEstimate: oe.runCost,
  };

  return {
    id: `artifact-sow-${ta.taskId}`,
    artifactType: "outsourcing_sow",
    status: "draft",
    deliveryChannel: "local_only",
    taskIds: [ta.taskId],
    skillIds,
    candidate: "outsource",
    ruleSetVersion: RULE_SET_VERSION,
    generatedAt: analysis.generatedAt,
    evidenceRefs: oe.evidence.slice(0, 3),
    unresolved: [],
    body,
  };
}

function buildApproval(
  selection: HumanSelection,
  candidateResult: CandidateResult,
  runnerUp: RankEntry | null,
  ta: TaskAnalysis,
  analysis: WorkforcePlacementAnalysis,
  counterEvidence: CounterEvidence[],
  defTask: Task | undefined,
): M2ApprovalGate {
  const oe = ta.optionEstimates.find(
    (o) => o.candidate === selection.selectedExecutionType,
  )!;
  const riskLevel = defTask?.risk.level ?? "medium";

  const supportingEvidence = oe.evidence.slice(0, 3).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const topCounter = counterEvidence
    .filter((c) => c.againstCandidate === selection.selectedExecutionType)
    .slice(0, 3)
    .sort((a, b) => a.id.localeCompare(b.id));

  const lowestConfidence = Math.min(
    ...ta.optionEstimates
      .filter((o) =>
        candidateResult.verdict === "eligible"
          ? o.candidate === candidateResult.candidate
          : true,
      )
      .map((o) => o.confidence.score),
  ) as RubricScore;

  return {
    requiresHumanApproval: true,
    state: selection.approval.state,
    actionType: "placement_commit",
    target: ta.taskId,
    candidate: selection.selectedExecutionType,
    totalScore: candidateResult.totalScore ?? 0,
    runnerUp: runnerUp?.candidate ?? null,
    margin:
      runnerUp !== null && candidateResult.totalScore !== null
        ? candidateResult.totalScore - runnerUp.totalScore
        : null,
    topSupportingEvidence: supportingEvidence,
    topCounterEvidence: topCounter,
    costRange: {
      low: oe.setupCost.low,
      base: oe.setupCost.base,
      high: oe.setupCost.high,
    },
    riskLevel: riskLevel as any,
    reversibility: oe.reversibility.score,
    lowestConfidence,
    proposedDiff: `Set executionType of ${ta.taskId} to ${selection.selectedExecutionType}`,
    expectedResult: `Task ${ta.taskId} is assigned to ${selection.selectedExecutionType}`,
    downside: `If the placement proves wrong, reversal costs apply`,
    rollback: `Revert executionType to undecided and reassess`,
    idempotencyKey: `placement-${ta.taskId}-${selection.selectedExecutionType}-${analysis.analysisId}`,
    scopeStatement: SCOPE_STATEMENT,
  };
}
