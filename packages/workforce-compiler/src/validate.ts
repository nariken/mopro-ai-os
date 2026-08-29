import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "./schema/workforce-definition.schema.json" with { type: "json" };
import {
  SIDE_EFFECTING_ACTION_TYPES,
  type ApprovalActionType,
  type EvidenceRef,
  type Process,
  type Task,
  type ValidationIndexes,
  type ValidationIssue,
  type ValidationResult,
  type WorkforceDefinition,
} from "./types.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
addFormats(ajv);

const validateSchema = ajv.compile(schema);

function issue(
  code: string,
  path: string,
  message: string,
  relatedIds: string[] = [],
): ValidationIssue {
  return { code, path, message, severity: "error", relatedIds };
}

function compareIssues(a: ValidationIssue, b: ValidationIssue): number {
  const byPath = a.path.localeCompare(b.path);
  if (byPath !== 0) return byPath;
  return a.code.localeCompare(b.code);
}

function sortStringRecord(record: Record<string, string[]>): Record<string, string[]> {
  const sorted: Record<string, string[]> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = [...record[key]!].sort();
  }
  return sorted;
}

function pointer(parts: Array<string | number>): string {
  return (
    "/" +
    parts
      .map((part) =>
        String(part).replaceAll("~", "~0").replaceAll("/", "~1"),
      )
      .join("/")
  );
}

function schemaPathToPointer(err: ErrorObject): string {
  if (err.instancePath) return err.instancePath;
  return "/";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asDefinition(value: unknown): WorkforceDefinition | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.businesses)) return null;
  if (!Array.isArray(value.processes)) return null;
  if (!Array.isArray(value.tasks)) return null;
  if (!Array.isArray(value.skills)) return null;
  return value as unknown as WorkforceDefinition;
}

function walkEvidence(
  evidence: EvidenceRef,
  path: string,
  syntheticDocument: boolean,
  issues: ValidationIssue[],
  seenIds: Map<string, string>,
): void {
  const prior = seenIds.get(evidence.id);
  if (prior) {
    issues.push(
      issue(
        "ID_DUPLICATE",
        path,
        `Evidence id "${evidence.id}" duplicates ${prior}`,
        [evidence.id],
      ),
    );
  } else {
    seenIds.set(evidence.id, path);
  }

  if (syntheticDocument && evidence.status === "observed") {
    issues.push(
      issue(
        "SYNTHETIC_OBSERVED_CONFLICT",
        `${path}/status`,
        "Synthetic documents cannot claim observed evidence",
        [evidence.id],
      ),
    );
  }
}

function registerEntityId(
  id: string,
  path: string,
  expectedPrefix: string,
  seenIds: Map<string, string>,
  issues: ValidationIssue[],
): void {
  if (!id.startsWith(expectedPrefix)) {
    issues.push(
      issue(
        "REFERENCE_WRONG_KIND",
        path,
        `Expected id prefix "${expectedPrefix}" but got "${id}"`,
        [id],
      ),
    );
  }
  const prior = seenIds.get(id);
  if (prior) {
    issues.push(
      issue("ID_DUPLICATE", path, `Id "${id}" duplicates ${prior}`, [id]),
    );
  } else {
    seenIds.set(id, path);
  }
}

function validateApproval(
  task: Task,
  taskIndex: number,
  issues: ValidationIssue[],
): void {
  const base = pointer(["tasks", taskIndex, "approval"]);
  const approval = task.approval;
  const sideEffecting = (SIDE_EFFECTING_ACTION_TYPES as readonly string[]).includes(
    approval.actionType,
  );

  if (approval.state === "executed") {
    issues.push(
      issue(
        "APPROVAL_STATE_FORBIDDEN_M1",
        `${base}/state`,
        "M1 forbids approval state executed because there is no executor",
        [task.id],
      ),
    );
  }

  if (sideEffecting) {
    if (!approval.requiresHumanApproval) {
      issues.push(
        issue(
          "APPROVAL_GATE_REQUIRED",
          `${base}/requiresHumanApproval`,
          `Side-effecting actionType "${approval.actionType}" requires Human Approval`,
          [task.id],
        ),
      );
    }
    if (task.authority !== "execute_after_approval") {
      issues.push(
        issue(
          "APPROVAL_GATE_REQUIRED",
          pointer(["tasks", taskIndex, "authority"]),
          `Side-effecting actionType "${approval.actionType}" requires authority execute_after_approval`,
          [task.id],
        ),
      );
    }
    const detailFields: Array<keyof typeof approval> = [
      "target",
      "proposedDiff",
      "expectedResult",
      "downside",
      "rollback",
      "idempotencyKey",
    ];
    for (const field of detailFields) {
      const value = approval[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push(
          issue(
            "APPROVAL_DETAILS_REQUIRED",
            `${base}/${field}`,
            `Approval detail "${field}" is required for side-effecting actions`,
            [task.id],
          ),
        );
      }
    }
  }
}

function hasProcessCycle(processes: Process[]): string[] | null {
  const byId = new Map(processes.map((process) => [process.id, process]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      return start >= 0 ? [...stack.slice(start), id] : [id, id];
    }
    if (visited.has(id)) return null;
    visiting.add(id);
    stack.push(id);
    const process = byId.get(id);
    if (process) {
      for (const dep of process.dependsOnProcessIds) {
        if (dep === id) return [id, id];
        if (!byId.has(dep)) continue;
        const cycle = visit(dep);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const process of processes) {
    const cycle = visit(process.id);
    if (cycle) return cycle;
  }
  return null;
}

function collectEvidence(
  def: WorkforceDefinition,
  issues: ValidationIssue[],
  seenIds: Map<string, string>,
): void {
  const synthetic = def.provenance.kind === "synthetic";
  for (const [i, source] of def.provenance.sources.entries()) {
    walkEvidence(
      source,
      pointer(["provenance", "sources", i]),
      synthetic,
      issues,
      seenIds,
    );
  }

  const visitMetricEvidence = (
    metrics: WorkforceDefinition["businesses"][number]["outcomeMetrics"],
    baseParts: Array<string | number>,
  ) => {
    for (const [i, metric] of metrics.entries()) {
      const prior = seenIds.get(metric.id);
      if (prior) {
        issues.push(
          issue(
            "ID_DUPLICATE",
            pointer([...baseParts, i, "id"]),
            `Metric id "${metric.id}" duplicates ${prior}`,
            [metric.id],
          ),
        );
      } else {
        seenIds.set(metric.id, pointer([...baseParts, i]));
      }
      walkEvidence(
        metric.evidence,
        pointer([...baseParts, i, "evidence"]),
        synthetic,
        issues,
        seenIds,
      );
    }
  };

  for (const [bi, business] of def.businesses.entries()) {
    visitMetricEvidence(business.outcomeMetrics, ["businesses", bi, "outcomeMetrics"]);
    for (const [ei, evidence] of business.evidence.entries()) {
      walkEvidence(
        evidence,
        pointer(["businesses", bi, "evidence", ei]),
        synthetic,
        issues,
        seenIds,
      );
    }
  }

  for (const [pi, process] of def.processes.entries()) {
    visitMetricEvidence(process.kpis, ["processes", pi, "kpis"]);
    for (const [ei, evidence] of process.evidence.entries()) {
      walkEvidence(
        evidence,
        pointer(["processes", pi, "evidence", ei]),
        synthetic,
        issues,
        seenIds,
      );
    }
  }

  for (const [si, skill] of def.skills.entries()) {
    for (const [ei, evidence] of skill.evidence.entries()) {
      walkEvidence(
        evidence,
        pointer(["skills", si, "evidence", ei]),
        synthetic,
        issues,
        seenIds,
      );
    }
  }

  for (const [ti, task] of def.tasks.entries()) {
    walkEvidence(
      task.frequency.evidence,
      pointer(["tasks", ti, "frequency", "evidence"]),
      synthetic,
      issues,
      seenIds,
    );
    walkEvidence(
      task.volume.evidence,
      pointer(["tasks", ti, "volume", "evidence"]),
      synthetic,
      issues,
      seenIds,
    );
    walkEvidence(
      task.currentTime.evidence,
      pointer(["tasks", ti, "currentTime", "evidence"]),
      synthetic,
      issues,
      seenIds,
    );
    walkEvidence(
      task.currentCost.evidence,
      pointer(["tasks", ti, "currentCost", "evidence"]),
      synthetic,
      issues,
      seenIds,
    );
    visitMetricEvidence(task.kpi, ["tasks", ti, "kpi"]);
    for (const [qi, criterion] of task.qualityStandard.entries()) {
      const prior = seenIds.get(criterion.id);
      if (prior) {
        issues.push(
          issue(
            "ID_DUPLICATE",
            pointer(["tasks", ti, "qualityStandard", qi, "id"]),
            `AcceptanceCriterion id "${criterion.id}" duplicates ${prior}`,
            [criterion.id],
          ),
        );
      } else {
        seenIds.set(criterion.id, pointer(["tasks", ti, "qualityStandard", qi]));
      }
    }
    for (const [ei, evidence] of task.evidence.entries()) {
      walkEvidence(
        evidence,
        pointer(["tasks", ti, "evidence", ei]),
        synthetic,
        issues,
        seenIds,
      );
    }
  }
}

function validateSemantics(def: WorkforceDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, string>();

  for (const [i, business] of def.businesses.entries()) {
    registerEntityId(business.id, pointer(["businesses", i, "id"]), "biz-", seenIds, issues);
  }
  for (const [i, process] of def.processes.entries()) {
    registerEntityId(process.id, pointer(["processes", i, "id"]), "proc-", seenIds, issues);
  }
  for (const [i, task] of def.tasks.entries()) {
    registerEntityId(task.id, pointer(["tasks", i, "id"]), "task-", seenIds, issues);
  }
  for (const [i, skill] of def.skills.entries()) {
    registerEntityId(skill.id, pointer(["skills", i, "id"]), "skill-", seenIds, issues);
  }

  collectEvidence(def, issues, seenIds);

  const businessById = new Map(def.businesses.map((b) => [b.id, b]));
  const processById = new Map(def.processes.map((p) => [p.id, p]));
  const taskById = new Map(def.tasks.map((t) => [t.id, t]));
  const skillById = new Map(def.skills.map((s) => [s.id, s]));

  const kindOf = (id: string): "biz" | "proc" | "task" | "skill" | null => {
    if (businessById.has(id)) return "biz";
    if (processById.has(id)) return "proc";
    if (taskById.has(id)) return "task";
    if (skillById.has(id)) return "skill";
    return null;
  };

  const expectKind = (
    id: string,
    expected: "biz" | "proc" | "task" | "skill",
    path: string,
    relatedIds: string[],
  ): boolean => {
    const kind = kindOf(id);
    if (kind === expected) return true;
    if (kind === null) {
      issues.push(
        issue(
          "REFERENCE_MISSING",
          path,
          `Missing ${expected} reference "${id}"`,
          relatedIds,
        ),
      );
      return false;
    }
    issues.push(
      issue(
        "REFERENCE_WRONG_KIND",
        path,
        `Expected ${expected} id but "${id}" is a ${kind}`,
        relatedIds,
      ),
    );
    return false;
  };

  for (const [bi, business] of def.businesses.entries()) {
    for (const [pi, processId] of business.processIds.entries()) {
      if (
        !expectKind(processId, "proc", pointer(["businesses", bi, "processIds", pi]), [
          business.id,
          processId,
        ])
      ) {
        continue;
      }
      const process = processById.get(processId)!;
      if (process.businessId !== business.id) {
        issues.push(
          issue(
            "OWNERSHIP_MISMATCH",
            pointer(["businesses", bi, "processIds", pi]),
            `Process "${processId}" does not point back to business "${business.id}"`,
            [business.id, processId],
          ),
        );
      }
    }
  }

  for (const [pi, process] of def.processes.entries()) {
    if (
      expectKind(
        process.businessId,
        "biz",
        pointer(["processes", pi, "businessId"]),
        [process.id, process.businessId],
      )
    ) {
      const owner = businessById.get(process.businessId)!;
      if (!owner.processIds.includes(process.id)) {
        issues.push(
          issue(
            "OWNERSHIP_MISMATCH",
            pointer(["processes", pi, "businessId"]),
            `Business "${process.businessId}" does not list process "${process.id}"`,
            [process.id, process.businessId],
          ),
        );
      }
    }

    for (const [di, depId] of process.dependsOnProcessIds.entries()) {
      expectKind(
        depId,
        "proc",
        pointer(["processes", pi, "dependsOnProcessIds", di]),
        [process.id, depId],
      );
    }

    const listedTaskCounts = new Map<string, number>();
    for (const [ti, taskId] of process.taskIds.entries()) {
      listedTaskCounts.set(taskId, (listedTaskCounts.get(taskId) ?? 0) + 1);
      if (
        !expectKind(taskId, "task", pointer(["processes", pi, "taskIds", ti]), [
          process.id,
          taskId,
        ])
      ) {
        continue;
      }
      const task = taskById.get(taskId)!;
      if (task.processId !== process.id) {
        issues.push(
          issue(
            "OWNERSHIP_MISMATCH",
            pointer(["processes", pi, "taskIds", ti]),
            `Task "${taskId}" does not point back to process "${process.id}"`,
            [process.id, taskId],
          ),
        );
      }
    }
    for (const [taskId, count] of listedTaskCounts) {
      if (count > 1) {
        issues.push(
          issue(
            "TASK_MULTIPLE_PROCESSES",
            pointer(["processes", pi, "taskIds"]),
            `Process lists task "${taskId}" ${count} times`,
            [process.id, taskId],
          ),
        );
      }
    }
  }

  const processOwnersByTask = new Map<string, string[]>();
  for (const process of def.processes) {
    for (const taskId of process.taskIds) {
      const owners = processOwnersByTask.get(taskId) ?? [];
      owners.push(process.id);
      processOwnersByTask.set(taskId, owners);
    }
  }

  for (const [ti, task] of def.tasks.entries()) {
    expectKind(
      task.processId,
      "proc",
      pointer(["tasks", ti, "processId"]),
      [task.id, task.processId],
    );

    const owners = processOwnersByTask.get(task.id) ?? [];
    if (owners.length === 0) {
      issues.push(
        issue(
          "OWNERSHIP_MISMATCH",
          pointer(["tasks", ti, "processId"]),
          `Task "${task.id}" is not listed by any process`,
          [task.id],
        ),
      );
    } else if (owners.length > 1) {
      issues.push(
        issue(
          "TASK_MULTIPLE_PROCESSES",
          pointer(["tasks", ti, "id"]),
          `Task "${task.id}" is listed by multiple processes`,
          [task.id, ...owners],
        ),
      );
    } else if (owners[0] !== task.processId) {
      issues.push(
        issue(
          "OWNERSHIP_MISMATCH",
          pointer(["tasks", ti, "processId"]),
          `Task processId "${task.processId}" does not match listing process "${owners[0]}"`,
          [task.id, task.processId, owners[0]!],
        ),
      );
    }

    for (const [si, required] of task.requiredSkills.entries()) {
      if (
        !expectKind(
          required.skillId,
          "skill",
          pointer(["tasks", ti, "requiredSkills", si, "skillId"]),
          [task.id, required.skillId],
        )
      ) {
        continue;
      }
      const skill = skillById.get(required.skillId)!;
      if (
        required.requiredLevel < skill.levelScale.min ||
        required.requiredLevel > skill.levelScale.max
      ) {
        issues.push(
          issue(
            "SKILL_LEVEL_OUT_OF_RANGE",
            pointer(["tasks", ti, "requiredSkills", si, "requiredLevel"]),
            `requiredLevel ${required.requiredLevel} is outside skill scale ${skill.levelScale.min}-${skill.levelScale.max}`,
            [task.id, required.skillId],
          ),
        );
      }
    }

    validateApproval(task, ti, issues);
  }

  const cycle = hasProcessCycle(def.processes);
  if (cycle) {
    issues.push(
      issue(
        "PROCESS_DEPENDENCY_CYCLE",
        "/processes",
        `Process dependency cycle detected: ${cycle.join(" -> ")}`,
        cycle,
      ),
    );
  }

  const taskIdsBySkillId: Record<string, string[]> = {};
  for (const task of def.tasks) {
    for (const required of task.requiredSkills) {
      if (!skillById.has(required.skillId)) continue;
      const list = taskIdsBySkillId[required.skillId] ?? [];
      if (!list.includes(task.id)) list.push(task.id);
      taskIdsBySkillId[required.skillId] = list;
    }
  }
  const reused = Object.values(taskIdsBySkillId).some((ids) => ids.length >= 2);
  if (!reused) {
    issues.push(
      issue(
        "SKILL_NOT_REUSED",
        "/skills",
        "M1 fixture profile requires at least one skill referenced by two or more tasks",
        [],
      ),
    );
  }

  return issues;
}

function buildIndexes(def: WorkforceDefinition): ValidationIndexes {
  const processIdsByBusinessId: Record<string, string[]> = {};
  const taskIdsByProcessId: Record<string, string[]> = {};
  const skillIdsByTaskId: Record<string, string[]> = {};
  const taskIdsBySkillId: Record<string, string[]> = {};

  for (const business of def.businesses) {
    processIdsByBusinessId[business.id] = [...business.processIds];
  }
  for (const process of def.processes) {
    taskIdsByProcessId[process.id] = [...process.taskIds];
  }
  for (const task of def.tasks) {
    skillIdsByTaskId[task.id] = task.requiredSkills.map((s) => s.skillId);
    for (const required of task.requiredSkills) {
      const list = taskIdsBySkillId[required.skillId] ?? [];
      if (!list.includes(task.id)) list.push(task.id);
      taskIdsBySkillId[required.skillId] = list;
    }
  }

  return {
    processIdsByBusinessId: sortStringRecord(processIdsByBusinessId),
    taskIdsByProcessId: sortStringRecord(taskIdsByProcessId),
    skillIdsByTaskId: sortStringRecord(skillIdsByTaskId),
    taskIdsBySkillId: sortStringRecord(taskIdsBySkillId),
  };
}

/**
 * Validate an unknown WorkforceDefinition document.
 * Never throws for user data; returns every safely discoverable issue.
 */
export function validateWorkforceDefinition(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const schemaOk = validateSchema(input);
  if (!schemaOk && validateSchema.errors) {
    for (const err of validateSchema.errors) {
      issues.push(
        issue(
          "SCHEMA_INVALID",
          schemaPathToPointer(err),
          err.message
            ? `${err.message}${err.params ? ` (${JSON.stringify(err.params)})` : ""}`
            : "Schema validation failed",
        ),
      );
    }
  }

  const def = asDefinition(input);
  if (def) {
    issues.push(...validateSemantics(def));
  }

  issues.sort(compareIssues);

  const schemaVersion =
    isRecord(input) && input.schemaVersion === "1.0.0" ? "1.0.0" : null;
  const valid = issues.length === 0;
  return {
    valid,
    schemaVersion,
    issues,
    indexes: valid && def ? buildIndexes(def) : null,
  };
}

/** Exported for tests that assert coverage of every side-effecting action type. */
export function sideEffectingActionTypes(): readonly ApprovalActionType[] {
  return SIDE_EFFECTING_ACTION_TYPES;
}
