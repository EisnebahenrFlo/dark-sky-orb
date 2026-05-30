/**
 * Single source of truth for thunderstorm risk across MeteoFlo.
 * Composite-Logik liegt in src/lib/thunderstormScore.ts (shared mit api/_lib).
 */
import { useMemo } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import type { HourlyData } from "@/lib/weather";
import {
  approxShear,
  computeHourScore,
  labelForLevel,
  levelForScore,
  type ScoreSource,
  type ThunderstormLevel,
} from "@/lib/thunderstormScore";

export type { ThunderstormLevel } from "@/lib/thunderstormScore";

export interface ThunderstormRisk {
  score: number;
  level: ThunderstormLevel;
  label: string;
  source: ScoreSource;
  /** Score ohne Tageszeit-Faktor — sinnvoll als Tages-Peak. */
  dayPeakScore: number;
}

export interface ThunderstormRiskSeries {
  current: ThunderstormRisk;
  hourly: ThunderstormRisk[];
  byDay: Record<string, ThunderstormRisk>;
  source: ScoreSource;
  hasData: boolean;
}

function makeRisk(score: number, source: ScoreSource, dayPeakScore = score): ThunderstormRisk {
  const level = levelForScore(score);
  return { score, level, label: labelForLevel(level), source, dayPeakScore };
}

const EMPTY: ThunderstormRisk = makeRisk(0, "lpi");

// Re-export für Bestandscode
export function scoreFromLPI(v: number | null | undefined) {
  return computeHourScore({ isoTime: new Date().toISOString(), lpi: v }).score;
}
export function scoreFromCAPE(v: number | null | undefined) {
  return computeHourScore({ isoTime: new Date().toISOString(), cape: v }).score;
}
export { levelForScore };

export function computeThunderstormRiskSeries(
  hourly: HourlyData | undefined,
  windowHours = 24,
): ThunderstormRiskSeries {
  if (!hourly || !hourly.time || hourly.time.length === 0) {
    return { current: EMPTY, hourly: [], byDay: {}, source: "lpi", hasData: false };
  }

  const lpi = hourly.lightning_potential;
  const cape = hourly.cape;
  const li = hourly.lifted_index;
  const cin = hourly.convective_inhibition;
  const gusts = hourly.wind_gusts_10m;
  const precip = hourly.precipitation;
  const w10 = hourly.wind_speed_10m;
  const w500 = hourly.wind_speed_500hPa;

  // Source-Detection: Mehrheit der Stunden in den nächsten 24h muss LPI-Signal haben.
  let lpiHours = 0;
  const lookahead = Math.min(24, hourly.time.length);
  for (let i = 0; i < lookahead; i++) {
    const v = lpi?.[i];
    if (typeof v === "number" && v >= 0.5) lpiHours++;
  }
  const seriesSource: ScoreSource = lpiHours >= 3 ? "lpi" : "cape";

  const hourlyRisks: ThunderstormRisk[] = hourly.time.map((t, i) => {
    const { score, source, dayPeakScore } = computeHourScore({
      isoTime: t,
      lpi: lpi?.[i],
      cape: cape?.[i],
      li: li?.[i],
      cin: cin?.[i],
      gustKmh: gusts?.[i],
      shearKmh: approxShear(w10?.[i], w500?.[i]),
      precipMmH: precip?.[i],
    });
    return makeRisk(score, source, dayPeakScore);
  });

  // Peak im Fenster ab jetzt
  const nowMs = Date.now();
  let startIdx = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (startIdx < 0) startIdx = 0;
  const window = hourlyRisks.slice(startIdx, startIdx + windowHours);
  const current = window.reduce<ThunderstormRisk>(
    (best, r) => (r.score > best.score ? r : best),
    makeRisk(0, seriesSource),
  );

  // Tages-Maximum — nutzt dayPeakScore, damit nächtliche Lagen nicht verschwinden.
  const byDay: Record<string, ThunderstormRisk> = {};
  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i].slice(0, 10);
    const r = hourlyRisks[i];
    const prev = byDay[day];
    if (!prev || r.dayPeakScore > prev.dayPeakScore) byDay[day] = r;
  }

  return { current, hourly: hourlyRisks, byDay, source: seriesSource, hasData: true };
}

export function useThunderstormRisk(windowHours = 24): ThunderstormRiskSeries {
  const { data, dataUpdatedAt } = useWeather();
  return useMemo(
    () => computeThunderstormRiskSeries(data?.hourly, windowHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataUpdatedAt, data?.hourly, windowHours],
  );
}
