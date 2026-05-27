/**
 * Zentraler Risiko-Hook: berechnet die 7 Wetter-Risiken aus den aktuellen
 * Stundendaten und liefert die Top 4 sortiert nach Score zurück.
 *
 * Alle Scores sind ganzzahlig 0–100 und nutzen identische Level-Schwellen.
 */
import { useMemo } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { useThunderstormRisk } from "@/hooks/useThunderstormRisk";

export type RiskId =
  | "gewitter"
  | "starkregen"
  | "hagel"
  | "sturm"
  | "schneesturm"
  | "glatteis"
  | "nebel";

export type RiskLevel = "none" | "low" | "moderate" | "high" | "extreme";

export interface RiskItem {
  id: RiskId;
  score: number;
  level: RiskLevel;
  label: string;
  isEstimate: boolean;
}

export interface UseWeatherRisksResult {
  risks: RiskItem[];
  isLoading: boolean;
  error: Error | null;
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  none: "Kein Risiko",
  low: "Gering",
  moderate: "Mäßig",
  high: "Hoch",
  extreme: "Extrem",
};

// Tiebreaker-Reihenfolge bei gleichem Score
const TIEBREAKER: RiskId[] = [
  "gewitter",
  "starkregen",
  "sturm",
  "hagel",
  "schneesturm",
  "glatteis",
  "nebel",
];

function levelForScore(score: number): RiskLevel {
  if (score >= 86) return "extreme";
  if (score >= 61) return "high";
  if (score >= 26) return "moderate";
  if (score >= 11) return "low";
  return "none";
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function makeRisk(id: RiskId, rawScore: number, isEstimate: boolean): RiskItem {
  const score = clampScore(rawScore);
  const level = levelForScore(score);
  return { id, score, level, label: LEVEL_LABEL[level], isEstimate };
}

export function useWeatherRisks(): UseWeatherRisksResult {
  const { data, isLoading, error } = useWeather();
  const thunderstorm = useThunderstormRisk(48);
  const thunderstormScore = thunderstorm.current.score;

  const risks = useMemo<RiskItem[]>(() => {
    const hourly = data?.hourly;

    // Index der aktuellen Stunde finden
    let i = 0;
    if (hourly?.time?.length) {
      const nowMs = Date.now();
      const idx = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs);
      i = idx >= 0 ? idx : 0;
    }

    const precipitation = hourly?.precipitation?.[i] ?? 0;
    const gusts = hourly?.wind_gusts_10m?.[i] ?? 0;
    const cape = hourly?.cape?.[i] ?? 0;
    const freezing = hourly?.freezing_level_height?.[i] ?? 9999;
    const snow = hourly?.snowfall?.[i] ?? 0;
    const temp2m = hourly?.temperature_2m?.[i] ?? 0;
    const wetBulb = hourly?.wet_bulb_temperature_2m?.[i] ?? temp2m - 2;
    const visibility = hourly?.visibility?.[i] ?? 10000;
    const wmoCode = hourly?.weather_code?.[i] ?? 0;

    // GEWITTER — zentraler Hook
    const gewitter = makeRisk("gewitter", thunderstormScore ?? 0, false);

    // STARKREGEN (mm/h)
    const rain = precipitation;
    const rainScore =
      rain <= 0
        ? 0
        : rain <= 5
          ? (rain / 5) * 25
          : rain <= 15
            ? 25 + ((rain - 5) / 10) * 35
            : rain <= 25
              ? 60 + ((rain - 15) / 10) * 25
              : 85 + Math.min(15, ((rain - 25) / 10) * 15);
    const starkregen = makeRisk("starkregen", rainScore, false);

    // STURM (Böen km/h)
    const sturmScore =
      gusts < 50
        ? 0
        : gusts < 65
          ? ((gusts - 50) / 15) * 25
          : gusts < 90
            ? 25 + ((gusts - 65) / 25) * 35
            : gusts < 120
              ? 60 + ((gusts - 90) / 30) * 25
              : 85 + Math.min(15, ((gusts - 120) / 20) * 15);
    const sturm = makeRisk("sturm", sturmScore, false);

    // HAGEL
    const isHailCode = [96, 99].includes(wmoCode);
    const capeNorm = Math.min(100, Math.round((cape / 2500) * 100));
    const freezingBonus = freezing < 2000 ? 15 : 0;
    const hagelScore = isHailCode
      ? Math.max(75, capeNorm)
      : Math.max(0, capeNorm * 0.6 + freezingBonus);
    const hagel = makeRisk("hagel", hagelScore, !isHailCode);

    // SCHNEESTURM (cm/h)
    const snowBase =
      snow <= 0
        ? 0
        : snow <= 1
          ? snow * 25
          : snow <= 3
            ? 25 + ((snow - 1) / 2) * 35
            : snow <= 5
              ? 60 + ((snow - 3) / 2) * 25
              : 85 + Math.min(15, ((snow - 5) / 2) * 15);
    const windMult = gusts > 50 ? 1.3 : gusts > 30 ? 1.1 : 1.0;
    const schneesturm = makeRisk("schneesturm", snowBase * windMult, false);

    // GLATTEIS
    const hasPrecip = precipitation > 0;
    const isIceCode = [56, 57, 66, 67].includes(wmoCode);
    const glatteisScore = isIceCode
      ? Math.max(60, (Math.abs(wetBulb) / 5) * 30 + 60)
      : hasPrecip && wetBulb <= 0
        ? Math.min(85, Math.abs(wetBulb) * 15 + 20)
        : hasPrecip && wetBulb <= 2
          ? (2 - wetBulb) * 10
          : 0;
    const glatteis = makeRisk("glatteis", glatteisScore, !isIceCode);

    // NEBEL (m)
    const vis = visibility;
    const nebelScore =
      vis >= 1000
        ? 0
        : vis >= 500
          ? ((1000 - vis) / 500) * 25
          : vis >= 200
            ? 25 + ((500 - vis) / 300) * 35
            : vis >= 50
              ? 60 + ((200 - vis) / 150) * 25
              : 85 + Math.min(15, ((50 - vis) / 50) * 15);
    const nebel = makeRisk("nebel", nebelScore, false);

    const all: RiskItem[] = [gewitter, starkregen, hagel, sturm, schneesturm, glatteis, nebel];

    // Top 4 nach Score, mit fester Tiebreaker-Reihenfolge
    const sorted = [...all].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return TIEBREAKER.indexOf(a.id) - TIEBREAKER.indexOf(b.id);
    });

    return sorted.slice(0, 4);
  }, [data, thunderstormScore]);

  return {
    risks,
    isLoading,
    error: (error as Error | null) ?? null,
  };
}
