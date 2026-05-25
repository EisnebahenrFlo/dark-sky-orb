/**
 * Single source of truth for thunderstorm risk across MeteoFlo.
 *
 * Primary signal: `lightning_potential` (LPI, J/kg) from Open-Meteo hourly
 *   (DWD ICON-D2 in DACH + Northern Italy).
 * Fallback: `cape` (J/kg) when LPI is unavailable or zero.
 *
 * All tabs (Heute, Warnungen, Stündlich, 7-Tage) MUST use this hook so the
 * displayed thunderstorm risk score is identical for the same location and
 * timestamp everywhere.
 */
import { useMemo } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import type { HourlyData } from "@/lib/weather";

export type ThunderstormLevel = "none" | "low" | "moderate" | "high" | "extreme";

export interface ThunderstormRisk {
  score: number; // 0–100, integer
  level: ThunderstormLevel;
  label: string; // German label
  source: "lpi" | "cape";
}

export interface ThunderstormRiskSeries {
  /** Peak risk over the next 24 h — used by the "current" card. */
  current: ThunderstormRisk;
  /** Per-hour risk aligned with hourly.time. */
  hourly: ThunderstormRisk[];
  /** Daily max risk keyed by YYYY-MM-DD. */
  byDay: Record<string, ThunderstormRisk>;
  /** Whether LPI was usable at all in this dataset. */
  source: "lpi" | "cape";
  hasData: boolean;
}

const LEVEL_LABEL: Record<ThunderstormLevel, string> = {
  none: "Kein Risiko",
  low: "Gering",
  moderate: "Mäßig",
  high: "Hoch",
  extreme: "Extrem",
};

export function levelForScore(score: number): ThunderstormLevel {
  if (score >= 86) return "extreme";
  if (score >= 61) return "high";
  if (score >= 31) return "moderate";
  if (score >= 11) return "low";
  return "none";
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** LPI J/kg → 0..100. Below 0.5 J/kg counts as no risk, 10 J/kg = 100. */
export function scoreFromLPI(lpi: number | null | undefined): number {
  if (lpi == null || Number.isNaN(lpi) || lpi < 0.5) return 0;
  return Math.round(clamp((lpi / 10) * 100, 0, 100));
}

/** CAPE J/kg → 0..100. 0 = 0, 500 = 50, 2000+ = 100 (piecewise linear). */
export function scoreFromCAPE(cape: number | null | undefined): number {
  if (cape == null || Number.isNaN(cape) || cape <= 0) return 0;
  if (cape <= 500) return Math.round((cape / 500) * 50);
  if (cape >= 2000) return 100;
  return Math.round(50 + ((cape - 500) / 1500) * 50);
}

function makeRisk(score: number, source: "lpi" | "cape"): ThunderstormRisk {
  const clamped = Math.round(clamp(score, 0, 100));
  const level = levelForScore(clamped);
  return { score: clamped, level, label: LEVEL_LABEL[level], source };
}

const EMPTY: ThunderstormRisk = makeRisk(0, "lpi");

/**
 * Compute the unified risk series from a WeatherData snapshot. Pure helper
 * so it can be reused outside React (tests, analytics, etc.).
 */
export function computeThunderstormRiskSeries(
  hourly: HourlyData | undefined,
): ThunderstormRiskSeries {
  if (!hourly || !hourly.time || hourly.time.length === 0) {
    return { current: EMPTY, hourly: [], byDay: {}, source: "lpi", hasData: false };
  }

  const lpi = hourly.lightning_potential;
  const cape = hourly.cape;
  const hasLPI = Array.isArray(lpi) && lpi.some((v) => typeof v === "number" && v >= 0.5);
  const source: "lpi" | "cape" = hasLPI ? "lpi" : "cape";

  const series: ThunderstormRisk[] = hourly.time.map((_, i) => {
    const lpiScore = scoreFromLPI(lpi?.[i]);
    if (lpiScore > 0) return makeRisk(lpiScore, "lpi");
    const capeScore = scoreFromCAPE(cape?.[i]);
    if (capeScore > 0) return makeRisk(capeScore, "cape");
    return makeRisk(0, source);
  });

  // Current = peak risk over the next 24 hourly entries from now.
  const nowMs = Date.now();
  let startIdx = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (startIdx < 0) startIdx = 0;
  const window = series.slice(startIdx, startIdx + 24);
  const current = window.reduce<ThunderstormRisk>(
    (best, r) => (r.score > best.score ? r : best),
    makeRisk(0, source),
  );

  // Per-day maximum.
  const byDay: Record<string, ThunderstormRisk> = {};
  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i].slice(0, 10);
    const r = series[i];
    const prev = byDay[day];
    if (!prev || r.score > prev.score) byDay[day] = r;
  }

  return { current, hourly: series, byDay, source, hasData: true };
}

/**
 * React hook — pulls the active weather snapshot from WeatherContext and
 * returns the unified thunderstorm risk series. Memoised on the timestamp
 * of the underlying data so repeated reads are cheap.
 */
export function useThunderstormRisk(): ThunderstormRiskSeries {
  const { data, dataUpdatedAt } = useWeather();
  return useMemo(
    () => computeThunderstormRiskSeries(data?.hourly),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataUpdatedAt, data?.hourly],
  );
}
