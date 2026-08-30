import type {
  AcceptanceCriterion,
  Authority,
  DocumentProvenance,
  EvidenceRef,
  Metric,
  Money,
  Quantity,
  RequiredSkill,
  RiskLevel,
  ValidationIssue,
} from "../types.js";

export type {
  AcceptanceCriterion,
  Authority,
  DocumentProvenance,
  EvidenceRef,
  Metric,
  Money,
  Quantity,
  RequiredSkill,
  RiskLevel,
  ValidationIssue,
};

export type ExecutionCandidate = "ai" | "existing_staff" | "hire" | "outsource";
export type RubricScore = 0 | 1 | 2 | 3 | 4 | 5;
export type Decision = "recommended" | "human_choice" | "undecided";
export type ComponentName =
  | "capability"
  | "capacityTime"
  | "qualityRisk"
  | "totalCost"
  | "reversibilityLearning";

export interface Rated {
  score: RubricScore;
  rubricId: string;
  rationale: string;
  evidence: EvidenceRef;
}

export interface DefinitionRef {
  definitionId: string;
  schemaVersion: "1.0.0";
  contentDigest: string;
}

export interface WorkCharacteristics {
  repeatability: Rated;
  digitality: Rated;
  exceptionRate: Rated;
  judgmentEmpathy: Rated;
  specifiability: Rated;
  procedureSteps: string[];
  knownExceptions: string[];
}

export interface OperatingConstraints {
  deadline: string | null;
  requiredAvailability: "business_hours" | "extended_hours" | "24x7";
  dataSensitivity: "public" | "internal" | "confidential" | "restricted";
  requiredAuthority: Authority;
  mustInternal: boolean;
  forbiddenExecutionTypes: ExecutionCandidate[];
  legalConstraints: string[];
  contractConstraints: string[];
  securityConstraints: string[];
  evidence: EvidenceRef[];
}

export interface Demand {
  frequency: Quantity;
  volume: Quantity;
  variabilityPct: Quantity;
  peakVolume: Quantity;
  slaTurnaround: Quantity;
}

export interface AttainedSkill {
  skillId: string;
  attainedLevel: 1 | 2 | 3 | 4 | 5 | null;
  evidence: EvidenceRef;
}

export interface CurrentState {
  ownerRoleId: string | null;
  capacity: Quantity;
  skillProfile: AttainedSkill[];
  timeSpent: Quantity;
  costPerPeriod: Money;
  qualityRecord: Rated;
  evidence: EvidenceRef[];
}

export interface CostEstimate {
  low: Money;
  base: Money;
  high: Money;
}

export interface OptionEstimate {
  candidate: ExecutionCandidate;
  setupTime: Quantity;
  setupCost: CostEstimate;
  runTime: Quantity;
  runCost: CostEstimate;
  availableCapacity: Quantity;
  toolAvailability: "available" | "obtainable_in_scope" | "unavailable" | "unknown";
  contextAvailability: "available" | "obtainable_in_scope" | "unavailable" | "unknown";
  authorityGrantable: boolean | null;
  attainableSkills: AttainedSkill[];
  learningTime: Quantity;
  expectedQuality: Rated;
  reversibility: Rated;
  learningValue: Rated;
  confidence: Rated;
  evidence: EvidenceRef[];
}

export interface CounterEvidence {
  id: string;
  againstCandidate: ExecutionCandidate;
  claim: string;
  weightHint: "minor" | "material" | "blocking";
  evidence: EvidenceRef;
}

export type M2ApprovalActionType =
  | "none"
  | "placement_commit"
  | "job_posting_publish"
  | "candidate_contact"
  | "contract_award"
  | "hiring_decision"
  | "budget_commit"
  | "account_connect"
  | "agent_external_write"
  | "real_data_ingest";

export interface M2ApprovalGate {
  requiresHumanApproval: true;
  state: "draft" | "pending" | "approved" | "rejected";
  actionType: M2ApprovalActionType;
  target: string;
  candidate: ExecutionCandidate;
  totalScore: number;
  runnerUp: ExecutionCandidate | null;
  margin: number | null;
  topSupportingEvidence: EvidenceRef[];
  topCounterEvidence: CounterEvidence[];
  costRange: { low: Money; base: Money; high: Money };
  riskLevel: RiskLevel;
  reversibility: RubricScore;
  lowestConfidence: RubricScore;
  proposedDiff: string;
  expectedResult: string;
  downside: string;
  rollback: string;
  idempotencyKey: string;
  scopeStatement: string;
}

export interface HumanSelection {
  taskId: string;
  selectedExecutionType: ExecutionCandidate;
  selectedAt: string;
  rationale: string;
  approval: M2ApprovalGate;
}

export interface TaskAnalysis {
  taskId: string;
  workCharacteristics: WorkCharacteristics;
  operatingConstraints: OperatingConstraints;
  demand: Demand;
  currentState: CurrentState;
  optionEstimates: OptionEstimate[];
  counterEvidence: CounterEvidence[];
}

export interface WorkforcePlacementAnalysis {
  schemaVersion: "2.0.0";
  analysisId: string;
  analysisVersion: string;
  ruleSetVersion: "wc-m2-rules/1.0.0";
  generatedAt: string;
  evaluationHorizonYears: 1 | 2 | 3;
  definitionRef: DefinitionRef;
  provenance: DocumentProvenance;
  scopeTaskIds: string[];
  taskAnalyses: TaskAnalysis[];
  humanSelections: HumanSelection[];
}

export interface Clarification {
  id: string;
  targetPath: string;
  question: string;
  whyBlocking: string;
  acceptableEvidence: string[];
}

export interface SensitivityEntry {
  targetPath: string;
  perturbation: "minus_one" | "plus_one" | "cost_low" | "cost_high";
  effect: "rank1_changed" | "top2_swapped";
  fromCandidate: ExecutionCandidate;
  toCandidate: ExecutionCandidate;
}

export interface ComponentScore {
  component: ComponentName;
  subScore: RubricScore;
  weight: number;
  points: number;
  inputPaths: string[];
  nearBoundary: boolean;
}

export interface CandidateResult {
  candidate: ExecutionCandidate;
  verdict: "eligible" | "ineligible" | "unknown";
  reasonCodes: string[];
  totalScore: number | null;
  breakdown: ComponentScore[] | null;
}

export interface RankEntry {
  rank: number;
  candidate: ExecutionCandidate;
  totalScore: number;
}

export interface TaskPlacementResult {
  taskId: string;
  decision: Decision;
  decisionReasonCodes: string[];
  candidates: CandidateResult[];
  ranking: RankEntry[];
  supportingEvidence: EvidenceRef[];
  counterEvidence: CounterEvidence[];
  assumptions: EvidenceRef[];
  missingEvidence: Clarification[];
  sensitivity: SensitivityEntry[];
  requiredClarifications: Clarification[];
  confirmedExecutionType: ExecutionCandidate | null;
  approval: M2ApprovalGate | null;
  artifacts: DraftArtifact[];
}

export interface PlacementResult {
  schemaVersion: "2.0.0";
  ruleSetVersion: "wc-m2-rules/1.0.0";
  analysisId: string;
  generatedAt: string;
  definitionRef: DefinitionRef;
  valid: boolean;
  issues: ValidationIssue[];
  tasks: TaskPlacementResult[];
}

export interface SkillGapBody {
  roleRef: string | null;
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

export interface AiAgentSpecBody {
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

export interface JobDescriptionBody {
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

export interface OutsourcingSowBody {
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

export type ArtifactBody =
  | SkillGapBody
  | AiAgentSpecBody
  | JobDescriptionBody
  | OutsourcingSowBody;

export type ArtifactType =
  | "skill_gap"
  | "ai_agent_spec"
  | "job_description"
  | "outsourcing_sow";

export interface DraftArtifact {
  id: string;
  artifactType: ArtifactType;
  status: "draft";
  deliveryChannel: "local_only";
  taskIds: string[];
  skillIds: string[];
  candidate: ExecutionCandidate;
  ruleSetVersion: string;
  generatedAt: string;
  evidenceRefs: EvidenceRef[];
  unresolved: Clarification[];
  body: ArtifactBody;
}
