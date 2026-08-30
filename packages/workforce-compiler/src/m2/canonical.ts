import { PERIOD_FACTORS_PER_YEAR } from "./rules.js";
import type { Money, Quantity } from "./types.js";

declare const crypto: { subtle: { digest(algo: string, data: Uint8Array): Promise<ArrayBuffer> } };
declare class TextEncoder { encode(input: string): Uint8Array; }

export function jcsCanonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(jcsCanonical).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const members = keys.map(
      (k) => JSON.stringify(k) + ":" + jcsCanonical(obj[k]),
    );
    return "{" + members.join(",") + "}";
  }
  return "null";
}

export async function computeDefinitionDigest(
  definition: unknown,
): Promise<string> {
  const canonical = jcsCanonical(definition);
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = "";
  for (const byte of hashArray) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return `sha256-${hex}`;
}

export interface CanonicalResult {
  ok: true;
  value: number;
}

export interface CanonicalError {
  ok: false;
  code: "UNIT_NOT_CANONICALIZABLE" | "UNIT_INCONSISTENT";
}

export type CanonicalOutcome = CanonicalResult | CanonicalError;

function periodFactor(period: string | null): number | null {
  if (period === null || period === "event") return null;
  return PERIOD_FACTORS_PER_YEAR[period] ?? null;
}

export function canonicalizePerYear(
  value: number | null,
  period: string | null,
  frequencyPerYear: number | null,
): CanonicalOutcome {
  if (value === null) return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
  if (period === "event") {
    if (frequencyPerYear === null)
      return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
    const result = value * frequencyPerYear;
    if (!Number.isFinite(result) || !Number.isInteger(result))
      return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
    return { ok: true, value: result };
  }
  const factor = periodFactor(period);
  if (factor === null) return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
  const result = value * factor;
  if (!Number.isFinite(result) || !Number.isInteger(result))
    return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
  return { ok: true, value: result };
}

export function computeFrequencyPerYear(freq: Quantity): CanonicalOutcome {
  if (freq.value === null)
    return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
  const factor = periodFactor(freq.period);
  if (factor === null) return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
  const result = freq.value * factor;
  if (!Number.isFinite(result) || !Number.isInteger(result))
    return { ok: false, code: "UNIT_NOT_CANONICALIZABLE" };
  return { ok: true, value: result };
}

export function canonicalizeMoneyPerYear(
  money: Money,
  frequencyPerYear: number | null,
): CanonicalOutcome {
  return canonicalizePerYear(money.amount, money.period, frequencyPerYear);
}

export function checkCurrencyConsistency(
  currencies: string[],
): boolean {
  if (currencies.length === 0) return true;
  return currencies.every((c) => c === currencies[0]);
}

export function slackMinutes(
  generatedAt: string,
  deadline: string,
): number {
  const gen = new Date(generatedAt).getTime();
  const dl = new Date(deadline + "T23:59:59Z").getTime();
  return Math.floor((dl - gen) / 60000);
}

export function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}
