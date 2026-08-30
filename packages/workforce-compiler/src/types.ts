/** Evidence classification for every factual claim in a WorkforceDefinition. */
export type EvidenceStatus = "observed" | "assumed" | "unverified";

/** Where a claim came from. Synthetic fixtures never use observed status. */
export type EvidenceSourceType =
  | "repository"
  | "notion"
  | "issue"
  | "synthetic"
  | "human"
  | "other";

export interface EvidenceRef {
  id: string;
  status: EvidenceStatus;
  sourceType: EvidenceSourceType;
  sourceRef: string | null;
  claim: string;
  /** RFC 3339; required when status is observed. */
  observedAt: string | null;
  note: string | null;
}

export interface DocumentProvenance {
  kind: "synthetic" | "real";
  /** RFC 3339 */
  generatedAt: string;
  sources: EvidenceRef[];
}

export type QuantityPeriod =
  | "event"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | null;

export interface Quantity {
  value: number | null;
  unit: string;
  period: QuantityPeriod;
  evidence: EvidenceRef;
}

export interface Money {
  amount: number | null;
  /** ISO 4217; fixture uses JPY. */
  currency: string;
  period: QuantityPeriod;
  evidence: EvidenceRef;
}

export interface Metric {
  id: string;
  name: string;
  unit: string;
  currentValue: number | null;
  targetValue: number | null;
  /** YYYY-MM-DD */
  deadline: string | null;
  measurementMethod: string;
  successCondition: string;
  stopCondition: string;
  evidence: EvidenceRef;
}

export interface AcceptanceCriterion {
  id: string;
  statement: string;
  verificationMethod: string;
  requiredEvidence: string;
}

export interface Business {
  id: string;
  name: string;
  purpose: string;
  targetCustomers: string[];
  valueProposition: string;
  outcomeMetrics: Metric[];
  processIds: string[];
  constraints: string[];
  evidence: EvidenceRef[];
}

export interface Process {
  id: string;
  businessId: string;
  name: string;
  purpose: string;
  trigger: string;
  exitCondition: string;
  kpis: Metric[];
  taskIds: string[];
  dependsOnProcessIds: string[];
  evidence: EvidenceRef[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  levelScale: {
    min: 1;
    max: 5;
    labels: [string, string, string, string, string];
  };
  evidence: EvidenceRef[];
}

export interface RequiredSkill {
  skillId: string;
  requiredLevel: 1 | 2 | 3 | 4 | 5;
  rationale: string;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Authority = "draft" | "recommend" | "execute_after_approval";
export type ApprovalState =
  | "not_required"
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "executed";

export type ApprovalActionType =
  | "none"
  | "external_write"
  | "publish"
  | "account_connect"
  | "budget_commit"
  | "campaign_launch"
  | "budget_change"
  | "campaign_pause"
  | "audience_upload"
  | "creative_publish"
  | "destructive_change"
  | "production_deploy";

export interface ApprovalGate {
  requiresHumanApproval: boolean;
  state: ApprovalState;
  actionType: ApprovalActionType;
  target: string | null;
  proposedDiff: string | null;
  expectedResult: string | null;
  downside: string | null;
  rollback: string | null;
  idempotencyKey: string | null;
}

export interface Task {
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

export interface WorkforceDefinition {
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

export interface ValidationIssue {
  code: string;
  /** RFC 6901 JSON Pointer */
  path: string;
  message: string;
  severity: "error";
  relatedIds: string[];
}

export interface ValidationIndexes {
  processIdsByBusinessId: Record<string, string[]>;
  taskIdsByProcessId: Record<string, string[]>;
  skillIdsByTaskId: Record<string, string[]>;
  taskIdsBySkillId: Record<string, string[]>;
}

export interface ValidationResult {
  valid: boolean;
  schemaVersion: "1.0.0" | null;
  issues: ValidationIssue[];
  indexes: ValidationIndexes | null;
}

/** Side-effecting approval action types that always require a Human Approval gate. */
export const SIDE_EFFECTING_ACTION_TYPES: readonly ApprovalActionType[] = [
  "external_write",
  "publish",
  "account_connect",
  "budget_commit",
  "campaign_launch",
  "budget_change",
  "campaign_pause",
  "audience_upload",
  "creative_publish",
  "destructive_change",
  "production_deploy",
] as const;

export const ERROR_CODES = [
  "SCHEMA_INVALID",
  "ID_DUPLICATE",
  "REFERENCE_MISSING",
  "REFERENCE_WRONG_KIND",
  "OWNERSHIP_MISMATCH",
  "TASK_MULTIPLE_PROCESSES",
  "PROCESS_DEPENDENCY_CYCLE",
  "SKILL_LEVEL_OUT_OF_RANGE",
  "SKILL_NOT_REUSED",
  "SYNTHETIC_OBSERVED_CONFLICT",
  "APPROVAL_GATE_REQUIRED",
  "APPROVAL_DETAILS_REQUIRED",
  "APPROVAL_STATE_FORBIDDEN_M1",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
