export { RULE_SET_VERSION, CANDIDATE_ORDER, MIN_RECOMMENDATION_MARGIN, COMPONENT_WEIGHTS, COMPONENT_ORDER, SCOPE_STATEMENT } from "./rules.js";
export { jcsCanonical, computeDefinitionDigest } from "./canonical.js";
export { compilePlacement, type CompileInput } from "./compile.js";
export { validatePlacementAnalysis, type ValidateOptions } from "./validate.js";
export { evaluateGate } from "./gate.js";
export { scoreCandidate, rankCandidates } from "./score.js";
export { computeSensitivity } from "./sensitivity.js";
export { makeDecision } from "./decide.js";
export { generateArtifacts } from "./artifacts.js";

export type {
  ExecutionCandidate,
  RubricScore,
  Decision,
  ComponentName,
  Rated,
  DefinitionRef,
  WorkCharacteristics,
  OperatingConstraints,
  Demand,
  AttainedSkill,
  CurrentState,
  CostEstimate,
  OptionEstimate,
  CounterEvidence,
  M2ApprovalActionType,
  M2ApprovalGate,
  HumanSelection,
  TaskAnalysis,
  WorkforcePlacementAnalysis,
  Clarification,
  SensitivityEntry,
  ComponentScore,
  CandidateResult,
  RankEntry,
  TaskPlacementResult,
  PlacementResult,
  DraftArtifact,
  ArtifactType,
  ArtifactBody,
  SkillGapBody,
  AiAgentSpecBody,
  JobDescriptionBody,
  OutsourcingSowBody,
} from "./types.js";
