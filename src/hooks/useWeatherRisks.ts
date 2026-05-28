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
  | "nebel"
  | "frost"
  | "hitze"
  | "uv";

export type RiskLevel = "none" | "low" | "moderate" | "high" | "extreme";

/** DWD-Warnstufen-Mapping aus dem 0–100-Score.
 *  Angelehnt an die offiziellen Stufen 1–4 (Wetterhinweis → extreme Unwetter). */
export type DwdStufe = 0 | 1 | 2 | 3 | 4;
export function dwdStufeForScore(score: number): DwdStufe {
  if (score >= 89) return 4; // extreme Unwetterwarnung (violett)
  if (score >= 71) return 3; // Unwetterwarnung (rot)
  if (score >= 51) return 2; // markante Wetterwarnung (orange)
  if (score >= 26) return 1; // Wetterhinweis / Warnung Stufe 1 (gelb)
  return 0;
}

export const DWD_STUFE_LABEL: Record<DwdStufe, string> = {
  0: "Keine Warnung",
  1: "Wetterhinweis · Stufe 1",
  2: "Markant · Stufe 2",
  3: "Unwetter · Stufe 3",
  4: "Extrem · Stufe 4",
};

export interface RiskItem {
  id: RiskId;
  score: number;
  level: RiskLevel;
  label: string;
  isEstimate: boolean;
  dwdStufe: DwdStufe;
  dwdLabel: string;
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
  "frost",
  "hitze",
  "uv",
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
  const dwdStufe = dwdStufeForScore(score);
  return {
    id, score, level,
    label: LEVEL_LABEL[level],
    isEstimate,
    dwdStufe,
    dwdLabel: DWD_STUFE_LABEL[dwdStufe],
  };
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

    // STARKREGEN (mm/h) — Maximum aus aktueller + nächsten 2 Stunden,
    // damit anrückende Zellen (Nowcast-Vorlauf) schon mitscoren.
    const rainNow = precipitation;
    const rainNext1 = hourly?.precipitation?.[i + 1] ?? 0;
    const rainNext2 = hourly?.precipitation?.[i + 2] ?? 0;
    const rain = Math.max(rainNow, rainNext1, rainNext2);
    const rainScore =
      rain < 0.5
        ? 0
        : rain <= 2
          ? ((rain - 0.5) / 1.5) * 15
          : rain <= 10
            ? 15 + ((rain - 2) / 8) * 25
            : rain <= 25
              ? 40 + ((rain - 10) / 15) * 30
              : rain <= 40
                ? 70 + ((rain - 25) / 15) * 18
                : 88 + Math.min(12, ((rain - 40) / 20) * 12);
    const starkregen = makeRisk("starkregen", rainScore, false);

    // STURM (Böen km/h) — Bft-orientiert, beginnt bei 40 km/h (Bft 6).
    const sturmScore =
      gusts < 40
        ? 0
        : gusts < 60
          ? ((gusts - 40) / 20) * 25
          : gusts < 80
            ? 25 + ((gusts - 60) / 20) * 30
            : gusts < 100
              ? 55 + ((gusts - 80) / 20) * 25
              : gusts < 120
                ? 80 + ((gusts - 100) / 20) * 12
                : 92 + Math.min(8, ((gusts - 120) / 20) * 8);
    const sturm = makeRisk("sturm", sturmScore, false);

    // HAGEL — nur bei konvektiver Lage (Gewitter-Score ≥ 30) oder explizitem
    // Hagel-Code, sonst 0. Eliminiert sommerliches CAPE-Rauschen.
    const isHailCode = [96, 99].includes(wmoCode);
    const capeNorm = Math.min(100, Math.round((cape / 2500) * 100));
    const freezingBonus = freezing < 2000 ? 15 : 0;
    const isConvective = (thunderstormScore ?? 0) >= 30;
    const hagelScore = isHailCode
      ? Math.max(80, capeNorm)
      : isConvective
        ? Math.max(0, capeNorm * 0.6 + freezingBonus)
        : 0;
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

    // FROST — Tagesminimum der Lufttemperatur in den nächsten 24h
    const next24 = hourly?.temperature_2m?.slice(i, i + 24) ?? [];
    const minT = next24.length ? Math.min(...next24) : 99;
    const frostScore =
      minT > 3 ? 0
      : minT > 0 ? ((3 - minT) / 3) * 25
      : minT > -5 ? 25 + ((-minT) / 5) * 35
      : minT > -10 ? 60 + ((-minT - 5) / 5) * 25
      : 85 + Math.min(15, ((-minT - 10) / 5) * 15);
    const frost = makeRisk("frost", frostScore, false);

    // HITZE — gefühlte Maximaltemperatur + Tropennacht-Bonus
    const nextApp = hourly?.apparent_temperature?.slice(i, i + 24) ?? [];
    const maxApp = nextApp.length ? Math.max(...nextApp) : -99;
    const tropennacht = next24.length ? Math.min(...next24) >= 20 : false;
    const hitzeBase =
      maxApp < 30 ? 0
      : maxApp < 32 ? ((maxApp - 30) / 2) * 25
      : maxApp < 35 ? 25 + ((maxApp - 32) / 3) * 35
      : maxApp < 38 ? 60 + ((maxApp - 35) / 3) * 25
      : 85 + Math.min(15, ((maxApp - 38) / 4) * 15);
    const hitzeScore = hitzeBase + (tropennacht ? 15 : 0);
    const hitze = makeRisk("hitze", hitzeScore, false);

    // UV — Tagesmax aus den nächsten 24h
    const nextUv = hourly?.uv_index?.slice(i, i + 24) ?? [];
    const maxUv = nextUv.length ? Math.max(...nextUv) : 0;
    const uvScore =
      maxUv < 6 ? 0
      : maxUv < 8 ? ((maxUv - 6) / 2) * 25
      : maxUv < 11 ? 25 + ((maxUv - 8) / 3) * 40
      : 65 + Math.min(35, ((maxUv - 11) / 2) * 35);
    const uv = makeRisk("uv", uvScore, false);

    const all: RiskItem[] = [gewitter, starkregen, hagel, sturm, schneesturm, glatteis, nebel, frost, hitze, uv];

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
