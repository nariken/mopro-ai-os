import { clamp } from "./canonical.js";
import { CANDIDATE_ORDER } from "./rules.js";
import {
  rankCandidates,
  scoreCandidate,
  type ScoreContext,
} from "./score.js";

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
import type {
  CandidateResult,
  ExecutionCandidate,
  OptionEstimate,
  RubricScore,
  SensitivityEntry,
  TaskAnalysis,
} from "./types.js";

export function computeSensitivity(
  eligibleCandidates: CandidateResult[],
  ctx: ScoreContext,
): SensitivityEntry[] {
  const entries: SensitivityEntry[] = [];
  const eligible = eligibleCandidates.filter(
    (c) => c.verdict === "eligible" && c.totalScore !== null,
  );
  if (eligible.length < 2) return entries;

  const baseRanking = rankCandidates(eligible);
  if (baseRanking.length < 2) return entries;
  const baseRank1 = baseRanking[0]!.candidate;
  const baseRank2 = baseRanking[1]!.candidate;

  for (const cr of eligible) {
    const candidate = cr.candidate;
    const oe = ctx.taskAnalysis.optionEstimates.find(
      (o) => o.candidate === candidate,
    )!;

    const rubricFields = getRubricFields(oe, ctx);

    for (const field of rubricFields) {
      for (const delta of [-1, 1] as const) {
        const newScore = clamp(0, 5, field.currentScore + delta);
        if (newScore === field.currentScore) continue;

        const perturbedResults = recomputeWithRubricChange(
          eligible,
          candidate,
          ctx,
          field.path,
          field.applyFn,
          newScore,
        );
        const perturbedRanking = rankCandidates(perturbedResults);
        if (perturbedRanking.length < 1) continue;

        const newRank1 = perturbedRanking[0]!.candidate;
        const newRank2 =
          perturbedRanking.length >= 2
            ? perturbedRanking[1]!.candidate
            : null;

        if (newRank1 !== baseRank1) {
          entries.push({
            targetPath: field.path,
            perturbation: delta === -1 ? "minus_one" : "plus_one",
            effect: "rank1_changed",
            fromCandidate: baseRank1,
            toCandidate: newRank1,
          });
        } else if (
          newRank2 !== null &&
          newRank2 !== baseRank2
        ) {
          entries.push({
            targetPath: field.path,
            perturbation: delta === -1 ? "minus_one" : "plus_one",
            effect: "top2_swapped",
            fromCandidate: baseRank2,
            toCandidate: newRank2,
          });
        }
      }
    }

    for (const costMode of ["cost_low", "cost_high"] as const) {
      const perturbedResults = recomputeWithCostChange(
        eligible,
        candidate,
        ctx,
        costMode === "cost_low" ? "low" : "high",
      );
      const perturbedRanking = rankCandidates(perturbedResults);
      if (perturbedRanking.length < 1) continue;

      const newRank1 = perturbedRanking[0]!.candidate;
      if (newRank1 !== baseRank1) {
        const oeIdx = ctx.taskAnalysis.optionEstimates.indexOf(oe);
        entries.push({
          targetPath: `/taskAnalyses/${ctx.taskIndex}/optionEstimates/${oeIdx}/${costMode === "cost_low" ? "setupCost/low" : "setupCost/high"}`,
          perturbation: costMode,
          effect: "rank1_changed",
          fromCandidate: baseRank1,
          toCandidate: newRank1,
        });
      }
    }
  }

  entries.sort((a, b) => {
    const pathCmp = a.targetPath.localeCompare(b.targetPath);
    if (pathCmp !== 0) return pathCmp;
    return a.perturbation.localeCompare(b.perturbation);
  });

  return entries;
}

interface RubricField {
  path: string;
  currentScore: number;
  applyFn: (oe: OptionEstimate, ta: TaskAnalysis, score: number) => void;
}

function getRubricFields(
  oe: OptionEstimate,
  ctx: ScoreContext,
): RubricField[] {
  const oeIdx = ctx.taskAnalysis.optionEstimates.indexOf(oe);
  const tiBase = `/taskAnalyses/${ctx.taskIndex}`;
  const oeBase = `${tiBase}/optionEstimates/${oeIdx}`;
  const fields: RubricField[] = [];

  fields.push({
    path: `${oeBase}/expectedQuality/score`,
    currentScore: oe.expectedQuality.score,
    applyFn: (o) => {
      /* applied in recompute */
    },
  });
  fields.push({
    path: `${oeBase}/reversibility/score`,
    currentScore: oe.reversibility.score,
    applyFn: () => {},
  });
  fields.push({
    path: `${oeBase}/learningValue/score`,
    currentScore: oe.learningValue.score,
    applyFn: () => {},
  });

  for (let i = 0; i < oe.attainableSkills.length; i++) {
    const skill = oe.attainableSkills[i]!;
    if (
      ctx.requiredSkillIds.includes(skill.skillId) &&
      skill.attainedLevel !== null
    ) {
      fields.push({
        path: `${oeBase}/attainableSkills/${i}/attainedLevel`,
        currentScore: skill.attainedLevel,
        applyFn: () => {},
      });
    }
  }

  if (
    oe.candidate === "ai" ||
    oe.candidate === "outsource"
  ) {
    const wcBase = `${tiBase}/workCharacteristics`;
    const wc = ctx.taskAnalysis.workCharacteristics;
    fields.push(
      {
        path: `${wcBase}/repeatability/score`,
        currentScore: wc.repeatability.score,
        applyFn: () => {},
      },
      {
        path: `${wcBase}/digitality/score`,
        currentScore: wc.digitality.score,
        applyFn: () => {},
      },
      {
        path: `${wcBase}/specifiability/score`,
        currentScore: wc.specifiability.score,
        applyFn: () => {},
      },
      {
        path: `${wcBase}/exceptionRate/score`,
        currentScore: wc.exceptionRate.score,
        applyFn: () => {},
      },
      {
        path: `${wcBase}/judgmentEmpathy/score`,
        currentScore: wc.judgmentEmpathy.score,
        applyFn: () => {},
      },
    );
  }

  return fields;
}

function recomputeWithRubricChange(
  eligible: CandidateResult[],
  targetCandidate: ExecutionCandidate,
  ctx: ScoreContext,
  fieldPath: string,
  _applyFn: RubricField["applyFn"],
  newScore: number,
): CandidateResult[] {
  return eligible.map((cr) => {
    if (cr.candidate !== targetCandidate) return cr;
    const modifiedTa = deepClone(ctx.taskAnalysis);
    const oe = modifiedTa.optionEstimates.find(
      (o: OptionEstimate) => o.candidate === targetCandidate,
    )!;

    applyFieldChange(oe, modifiedTa, fieldPath, newScore, ctx.taskIndex);

    const modCtx: ScoreContext = { ...ctx, taskAnalysis: modifiedTa };
    const scored = scoreCandidate(targetCandidate, modCtx);
    return {
      ...cr,
      totalScore: scored.totalScore,
      breakdown: scored.breakdown,
    };
  });
}

function recomputeWithCostChange(
  eligible: CandidateResult[],
  targetCandidate: ExecutionCandidate,
  ctx: ScoreContext,
  mode: "low" | "high",
): CandidateResult[] {
  return eligible.map((cr) => {
    if (cr.candidate !== targetCandidate) return cr;
    const modifiedTa = deepClone(ctx.taskAnalysis);
    const oe = modifiedTa.optionEstimates.find(
      (o: OptionEstimate) => o.candidate === targetCandidate,
    )!;

    if (mode === "low") {
      oe.setupCost.base = deepClone(oe.setupCost.low);
      oe.runCost.base = deepClone(oe.runCost.low);
    } else {
      oe.setupCost.base = deepClone(oe.setupCost.high);
      oe.runCost.base = deepClone(oe.runCost.high);
    }

    const modCtx: ScoreContext = { ...ctx, taskAnalysis: modifiedTa };
    const scored = scoreCandidate(targetCandidate, modCtx);
    return {
      ...cr,
      totalScore: scored.totalScore,
      breakdown: scored.breakdown,
    };
  });
}

function applyFieldChange(
  oe: OptionEstimate,
  ta: TaskAnalysis,
  fieldPath: string,
  newScore: number,
  taskIndex: number,
): void {
  const clamped = clamp(0, 5, newScore) as RubricScore;
  const oeIdx = ta.optionEstimates.indexOf(oe);
  const oePrefix = `/taskAnalyses/${taskIndex}/optionEstimates/${oeIdx}`;
  const wcPrefix = `/taskAnalyses/${taskIndex}/workCharacteristics`;

  if (fieldPath === `${oePrefix}/expectedQuality/score`) {
    oe.expectedQuality = { ...oe.expectedQuality, score: clamped };
  } else if (fieldPath === `${oePrefix}/reversibility/score`) {
    oe.reversibility = { ...oe.reversibility, score: clamped };
  } else if (fieldPath === `${oePrefix}/learningValue/score`) {
    oe.learningValue = { ...oe.learningValue, score: clamped };
  } else if (fieldPath.startsWith(`${oePrefix}/attainableSkills/`)) {
    const match = fieldPath.match(/attainableSkills\/(\d+)\/attainedLevel/);
    if (match) {
      const idx = parseInt(match[1]!, 10);
      if (oe.attainableSkills[idx]) {
        oe.attainableSkills[idx] = {
          ...oe.attainableSkills[idx]!,
          attainedLevel: clamped as 1 | 2 | 3 | 4 | 5,
        };
      }
    }
  } else if (fieldPath === `${wcPrefix}/repeatability/score`) {
    ta.workCharacteristics.repeatability = {
      ...ta.workCharacteristics.repeatability,
      score: clamped,
    };
  } else if (fieldPath === `${wcPrefix}/digitality/score`) {
    ta.workCharacteristics.digitality = {
      ...ta.workCharacteristics.digitality,
      score: clamped,
    };
  } else if (fieldPath === `${wcPrefix}/specifiability/score`) {
    ta.workCharacteristics.specifiability = {
      ...ta.workCharacteristics.specifiability,
      score: clamped,
    };
  } else if (fieldPath === `${wcPrefix}/exceptionRate/score`) {
    ta.workCharacteristics.exceptionRate = {
      ...ta.workCharacteristics.exceptionRate,
      score: clamped,
    };
  } else if (fieldPath === `${wcPrefix}/judgmentEmpathy/score`) {
    ta.workCharacteristics.judgmentEmpathy = {
      ...ta.workCharacteristics.judgmentEmpathy,
      score: clamped,
    };
  }
}
