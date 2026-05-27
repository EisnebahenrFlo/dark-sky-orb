/**
 * Single source of truth for thunderstorm risk across MeteoFlo.
 *
 * Composite-Score aus 4 Signalen (wie operationelle Meteorologen arbeiten):
 *   1. LPI  — Lightning Potential Index (primäres Signal, DWD ICON-D2)
 *   2. CAPE — Konvektionsenergie (Fallback wenn kein LPI)
 *   3. Lifted Index — Verstärker/Dämpfer der Instabilität
 *   4. CIN  — Convective Inhibition (Bremse/Gate-Keeper)
 *   + Tageszeit-Gewichtung (Konvektion entsteht durch Erwärmung)
 *
 * Alle Tabs nutzen diesen Hook → identische Werte überall.
 */
import { useMemo } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import type { HourlyData } from "@/lib/weather";

export type ThunderstormLevel = "none" | "low" | "moderate" | "high" | "extreme";

export interface ThunderstormRisk {
  score: number;
  level: ThunderstormLevel;
  label: string;
  source: "lpi" | "cape";
}

export interface ThunderstormRiskSeries {
  current: ThunderstormRisk;
  hourly: ThunderstormRisk[];
  byDay: Record<string, ThunderstormRisk>;
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

export function scoreFromLPI(lpi: number | null | undefined): number {
  if (lpi == null || Number.isNaN(lpi) || lpi < 0.5) return 0;
  return Math.round(clamp((lpi / 10) * 100, 0, 100));
}

export function scoreFromCAPE(cape: number | null | undefined): number {
  if (cape == null || Number.isNaN(cape) || cape <= 0) return 0;
  if (cape >= 2500) return 80;
  if (cape >= 1500) return 65;
  if (cape >= 1000) return 50;
  if (cape >= 500) return 35;
  if (cape >= 300) return 20;
  return 0;
}

/**
 * Lifted Index → Multiplikator.
 * Quelle: NWS / WMO operationelle Schwellenwerte.
 *   LI >= 0       = stabil, dämpfen
 *   LI 0..-2      = leicht instabil, neutral
 *   LI -2..-6     = instabil, verstärken
 *   LI < -6       = schwere Gewitter sehr wahrscheinlich, stark verstärken
 */
function liFactor(li: number | null | undefined): number {
  if (li == null || Number.isNaN(li)) return 1.0;
  if (li >= 2)  return 0.6;
  if (li >= 0)  return 0.85;
  if (li >= -2) return 1.0;
  if (li >= -6) return 1.25;
  return 1.5;
}

/**
 * CIN → Dämpfungs-Faktor (Gate-Keeper).
 * CIN ist negativ in J/kg. Je negativer, desto stärker die Sperrschicht.
 * Quelle: Atmosphärenphysik — CIN > 200 J/kg verhindert Konvektion praktisch vollständig.
 */
function cinFactor(cin: number | null | undefined): number {
  if (cin == null || Number.isNaN(cin)) return 1.0;
  const absCin = Math.abs(cin); // CIN kommt als negative Zahl
  if (absCin <= 10)  return 1.0;   // keine Hemmung
  if (absCin <= 50)  return 0.85;  // leichte Hemmung
  if (absCin <= 100) return 0.65;  // mäßige Hemmung
  if (absCin <= 200) return 0.3;   // starke Sperrschicht
  return 0.05;                      // Konvektion praktisch gesperrt
}

/**
 * Tageszeit-Faktor.
 * Konvektion entsteht fast immer durch Tageserwärmung.
 * Ausnahme: Frontgewitter (dann ist LPI das dominante Signal und schon hoch).
 */
function daytimeFactor(isoTime: string): number {
  const h = new Date(isoTime).getHours();
  if (h >= 0  && h <= 5)  return 0.5;
  if (h >= 6  && h <= 9)  return 0.8;
  if (h >= 10 && h <= 19) return 1.0;
  if (h >= 20 && h <= 22) return 0.75;
  return 0.5; // 23 Uhr
}

function makeRisk(score: number, source: "lpi" | "cape"): ThunderstormRisk {
  const clamped = Math.round(clamp(score, 0, 100));
  const level = levelForScore(clamped);
  return { score: clamped, level, label: LEVEL_LABEL[level], source };
}

const EMPTY: ThunderstormRisk = makeRisk(0, "lpi");

/**
 * Berechnet den Composite-Score für eine einzelne Stunde.
 */
function computeHourScore(
  lpiVal: number | null | undefined,
  capeVal: number | null | undefined,
  liVal: number | null | undefined,
  cinVal: number | null | undefined,
  gustVal: number | null | undefined,
  isoTime: string,
): { score: number; source: "lpi" | "cape" } {
  // Basis: CAPE-Score
  const baseScore = scoreFromCAPE(capeVal);

  // Additive Boni
  let bonus = 0;
  const lpi = typeof lpiVal === "number" && !Number.isNaN(lpiVal) ? lpiVal : 0;
  if (lpi > 5) bonus += 15;
  else if (lpi > 0) bonus += 10;

  const cape = typeof capeVal === "number" && !Number.isNaN(capeVal) ? capeVal : 0;
  const gust = typeof gustVal === "number" && !Number.isNaN(gustVal) ? gustVal : 0;
  if (gust > 50 && cape > 300) bonus += 5;

  const rawScore = baseScore + bonus;
  const source: "lpi" | "cape" = lpi > 0 ? "lpi" : "cape";

  // Modifier: LI/CIN/Tageszeit weiterhin multiplikativ
  const modifiedScore = rawScore * liFactor(liVal) * cinFactor(cinVal) * daytimeFactor(isoTime);

  return { score: modifiedScore, source };
}

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

  const hasLPI = Array.isArray(lpi) && lpi.some((v) => typeof v === "number" && v >= 0.5);
  const source: "lpi" | "cape" = hasLPI ? "lpi" : "cape";

  const gusts = hourly.wind_gusts_10m;

  const series: ThunderstormRisk[] = hourly.time.map((t, i) => {
    const { score, source: s } = computeHourScore(
      lpi?.[i],
      cape?.[i],
      li?.[i],
      cin?.[i],
      gusts?.[i],
      t,
    );
    return makeRisk(score, s);
  });

  // Peak im konfigurierbaren Zeitfenster ab jetzt
  const nowMs = Date.now();
  let startIdx = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (startIdx < 0) startIdx = 0;
  const window = series.slice(startIdx, startIdx + windowHours);
  const current = window.reduce<ThunderstormRisk>(
    (best, r) => (r.score > best.score ? r : best),
    makeRisk(0, source),
  );

  // Tages-Maximum
  const byDay: Record<string, ThunderstormRisk> = {};
  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i].slice(0, 10);
    const r = series[i];
    const prev = byDay[day];
    if (!prev || r.score > prev.score) byDay[day] = r;
  }

  return { current, hourly: series, byDay, source, hasData: true };
}

export function useThunderstormRisk(windowHours = 24): ThunderstormRiskSeries {
  const { data, dataUpdatedAt } = useWeather();
  return useMemo(
    () => computeThunderstormRiskSeries(data?.hourly, windowHours),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataUpdatedAt, data?.hourly, windowHours],
  );
}
