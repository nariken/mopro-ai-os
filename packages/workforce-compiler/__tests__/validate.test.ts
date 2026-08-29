import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SIDE_EFFECTING_ACTION_TYPES,
  validateWorkforceDefinition,
  type ApprovalActionType,
  type WorkforceDefinition,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(
  here,
  "../../../docs/fixtures/workforce-compiler/advertising-strategy-operator.synthetic.json",
);

function loadFixture(): WorkforceDefinition {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as WorkforceDefinition;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expectCode(input: unknown, code: string): void {
  const result = validateWorkforceDefinition(input);
  expect(result.valid).toBe(false);
  expect(result.indexes).toBeNull();
  expect(result.issues.some((issue) => issue.code === code)).toBe(true);
}

describe("Workforce Compiler M1 validator", () => {
  it("accepts the canonical synthetic fixture and builds sorted indexes", () => {
    const fixture = loadFixture();
    const first = validateWorkforceDefinition(fixture);
    const second = validateWorkforceDefinition(fixture);

    expect(first.valid).toBe(true);
    expect(first.schemaVersion).toBe("1.0.0");
    expect(first.issues).toEqual([]);
    expect(first.indexes).not.toBeNull();
    expect(second).toEqual(first);

    const indexes = first.indexes!;
    expect(indexes.processIdsByBusinessId["biz-paid-acquisition-saas"]).toEqual([
      "proc-measurement-optimization",
      "proc-strategy-experiment-design",
    ]);
    expect(indexes.taskIdsByProcessId["proc-strategy-experiment-design"]).toEqual([
      "task-forecast-campaign-draft",
      "task-platform-fit-assessment",
    ]);
    expect(indexes.taskIdsByProcessId["proc-measurement-optimization"]).toEqual([
      "task-continue-change-stop-recommendation",
      "task-measurement-readiness-review",
    ]);
    expect(
      indexes.taskIdsBySkillId["skill-unit-economics-analysis"]!.length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      indexes.taskIdsBySkillId["skill-experiment-design"]!.length,
    ).toBeGreaterThanOrEqual(2);

    for (const processId of indexes.processIdsByBusinessId["biz-paid-acquisition-saas"]!) {
      expect(fixture.processes.some((process) => process.id === processId)).toBe(true);
    }
    for (const [processId, taskIds] of Object.entries(indexes.taskIdsByProcessId)) {
      for (const taskId of taskIds) {
        const task = fixture.tasks.find((entry) => entry.id === taskId);
        expect(task?.processId).toBe(processId);
      }
    }
  });

  it("rejects missing required fields and invalid enums via schema", () => {
    const missingTitle = clone(loadFixture()) as Record<string, unknown>;
    delete missingTitle.title;
    expectCode(missingTitle, "SCHEMA_INVALID");

    const badEnum = clone(loadFixture());
    badEnum.tasks[0]!.risk.level = "extreme" as never;
    expectCode(badEnum, "SCHEMA_INVALID");
  });

  it("rejects missing and wrong-kind references", () => {
    const missing = clone(loadFixture());
    missing.tasks[0]!.requiredSkills[0]!.skillId = "skill-does-not-exist";
    expectCode(missing, "REFERENCE_MISSING");

    const wrongKind = clone(loadFixture());
    wrongKind.tasks[0]!.processId = "biz-paid-acquisition-saas" as never;
    expectCode(wrongKind, "REFERENCE_WRONG_KIND");
  });

  it("rejects duplicate ids", () => {
    const duplicate = clone(loadFixture());
    duplicate.skills[1]!.id = duplicate.skills[0]!.id;
    expectCode(duplicate, "ID_DUPLICATE");
  });

  it("rejects tasks listed by zero or two processes", () => {
    const orphan = clone(loadFixture());
    orphan.processes[0]!.taskIds = orphan.processes[0]!.taskIds.filter(
      (id) => id !== "task-platform-fit-assessment",
    );
    expectCode(orphan, "OWNERSHIP_MISMATCH");

    const multi = clone(loadFixture());
    multi.processes[1]!.taskIds.push("task-platform-fit-assessment");
    expectCode(multi, "TASK_MULTIPLE_PROCESSES");
  });

  it("rejects process dependency cycles", () => {
    const cyclic = clone(loadFixture());
    cyclic.processes[0]!.dependsOnProcessIds = ["proc-measurement-optimization"];
    cyclic.processes[1]!.dependsOnProcessIds = ["proc-strategy-experiment-design"];
    expectCode(cyclic, "PROCESS_DEPENDENCY_CYCLE");
  });

  it("rejects negative quantities and missing unit/currency", () => {
    const negative = clone(loadFixture());
    negative.tasks[0]!.currentTime.value = -1;
    expectCode(negative, "SCHEMA_INVALID");

    const missingUnit = clone(loadFixture());
    missingUnit.tasks[0]!.volume.unit = "";
    expectCode(missingUnit, "SCHEMA_INVALID");

    const missingCurrency = clone(loadFixture());
    missingCurrency.tasks[0]!.currentCost.currency = "yen" as never;
    expectCode(missingCurrency, "SCHEMA_INVALID");
  });

  it("rejects out-of-range skill levels and unused-skill profiles", () => {
    const outOfRange = clone(loadFixture());
    outOfRange.tasks[0]!.requiredSkills[0]!.requiredLevel = 9 as never;
    expectCode(outOfRange, "SKILL_LEVEL_OUT_OF_RANGE");

    const noReuse = clone(loadFixture());
    for (const task of noReuse.tasks) {
      task.requiredSkills = [
        {
          skillId: `skill-unique-for-${task.id.replace(/^task-/, "")}`,
          requiredLevel: 2,
          rationale: "Force unique skills for rejection",
        },
      ];
    }
    noReuse.skills = noReuse.tasks.map((task) => ({
      id: task.requiredSkills[0]!.skillId,
      name: task.requiredSkills[0]!.skillId,
      description: "Temporary unique skill",
      levelScale: {
        min: 1 as const,
        max: 5 as const,
        labels: ["1", "2", "3", "4", "5"] as [
          string,
          string,
          string,
          string,
          string,
        ],
      },
      evidence: [
        {
          id: `ev-${task.requiredSkills[0]!.skillId}`,
          status: "assumed" as const,
          sourceType: "synthetic" as const,
          sourceRef: null,
          claim: "unique",
          observedAt: null,
          note: null,
        },
      ],
    }));
    expectCode(noReuse, "SKILL_NOT_REUSED");
  });

  it("rejects synthetic observed evidence and missing evidence status", () => {
    const observed = clone(loadFixture());
    observed.provenance.sources[0]!.status = "observed";
    observed.provenance.sources[0]!.sourceRef = "https://example.invalid/observed";
    observed.provenance.sources[0]!.observedAt = "2026-08-30T00:00:00Z";
    expectCode(observed, "SYNTHETIC_OBSERVED_CONFLICT");

    const missingStatus = clone(loadFixture()) as Record<string, unknown>;
    const businesses = missingStatus.businesses as Array<Record<string, unknown>>;
    const evidence = (businesses[0]!.evidence as Array<Record<string, unknown>>)[0]!;
    delete evidence.status;
    expectCode(missingStatus, "SCHEMA_INVALID");
  });

  it("rejects incomplete approval gates for every side-effecting action type", () => {
    expect(SIDE_EFFECTING_ACTION_TYPES.length).toBeGreaterThan(0);

    for (const actionType of SIDE_EFFECTING_ACTION_TYPES) {
      const noGate = clone(loadFixture());
      const task = noGate.tasks.find((entry) => entry.id === "task-platform-fit-assessment")!;
      task.authority = "draft";
      task.approval = {
        requiresHumanApproval: false,
        state: "not_required",
        actionType: actionType as ApprovalActionType,
        target: null,
        proposedDiff: null,
        expectedResult: null,
        downside: null,
        rollback: null,
        idempotencyKey: null,
      };
      const noGateResult = validateWorkforceDefinition(noGate);
      expect(noGateResult.valid).toBe(false);
      expect(
        noGateResult.issues.some(
          (issue) =>
            issue.code === "APPROVAL_GATE_REQUIRED" ||
            issue.code === "SCHEMA_INVALID" ||
            issue.code === "APPROVAL_DETAILS_REQUIRED",
        ),
      ).toBe(true);

      const incomplete = clone(loadFixture());
      const launch = incomplete.tasks.find(
        (entry) => entry.id === "task-forecast-campaign-draft",
      )!;
      launch.approval.actionType = actionType;
      launch.approval.requiresHumanApproval = true;
      launch.approval.state = "draft";
      launch.authority = "execute_after_approval";
      launch.approval.target = "synthetic://target";
      launch.approval.proposedDiff = "diff";
      launch.approval.expectedResult = "result";
      launch.approval.downside = "downside";
      launch.approval.rollback = "rollback";
      launch.approval.idempotencyKey = "";
      expectCode(incomplete, "APPROVAL_DETAILS_REQUIRED");

      const executed = clone(loadFixture());
      const executedTask = executed.tasks.find(
        (entry) => entry.id === "task-forecast-campaign-draft",
      )!;
      executedTask.approval.actionType = actionType;
      executedTask.approval.requiresHumanApproval = true;
      executedTask.approval.state = "executed";
      executedTask.authority = "execute_after_approval";
      executedTask.approval.target = "synthetic://target";
      executedTask.approval.proposedDiff = "diff";
      executedTask.approval.expectedResult = "result";
      executedTask.approval.downside = "downside";
      executedTask.approval.rollback = "rollback";
      executedTask.approval.idempotencyKey = `key-${actionType}`;
      const executedResult = validateWorkforceDefinition(executed);
      expect(executedResult.valid).toBe(false);
      expect(
        executedResult.issues.some(
          (issue) =>
            issue.code === "APPROVAL_STATE_FORBIDDEN_M1" ||
            issue.code === "SCHEMA_INVALID",
        ),
      ).toBe(true);
    }
  });

  it("sorts issues deterministically by path then code", () => {
    const broken = clone(loadFixture());
    broken.tasks[0]!.requiredSkills[0]!.skillId = "skill-missing-a";
    broken.tasks[1]!.requiredSkills[0]!.skillId = "skill-missing-b";
    const result = validateWorkforceDefinition(broken);
    const paths = result.issues.map((issue) => `${issue.path}|${issue.code}`);
    expect(paths).toEqual([...paths].sort());
  });
});
