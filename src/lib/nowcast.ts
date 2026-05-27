import type { MinutelyData } from "./weather";

export interface NowcastSummary {
  /** Sum in mm over the considered window. Always ≥ 0. */
  sum: number;
  /** Number of valid (finite, ≥ 0) slots actually summed. */
  validCount: number;
  /** Number of slots requested. */
  requested: number;
  /** True when at least one valid slot was found. */
  hasData: boolean;
}

/**
 * Robustly sum the next `count` precipitation slots from minutely_15.
 *
 * Guards against:
 *  - missing/undefined `minutely` or `precipitation` array
 *  - non-array values
 *  - shorter-than-expected arrays
 *  - null / undefined / NaN / Infinity entries
 *  - negative values (clamped to 0)
 *  - count <= 0
 */
export function summarizeNowcastPrecip(
  minutely: Partial<MinutelyData> | null | undefined,
  count = 8,
): NowcastSummary {
  const requested = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const arr = minutely?.precipitation;
  if (!Array.isArray(arr) || requested === 0) {
    return { sum: 0, validCount: 0, requested, hasData: false };
  }

  let sum = 0;
  let validCount = 0;
  const upper = Math.min(arr.length, requested);
  for (let i = 0; i < upper; i++) {
    const raw = arr[i];
    if (raw == null) continue;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    sum += n > 0 ? n : 0;
    validCount += 1;
  }

  return {
    sum: Number.isFinite(sum) && sum > 0 ? sum : 0,
    validCount,
    requested,
    hasData: validCount > 0,
  };
}
