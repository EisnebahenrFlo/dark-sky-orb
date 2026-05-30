/**
 * Server-Kopie von src/lib/thunderstormScore.ts (Vercel Serverless).
 * Bei jeder Änderung BEIDE Dateien anpassen und THUNDERSTORM_SCORE_VERSION erhöhen.
 */

export const THUNDERSTORM_SCORE_VERSION = "2026-05-30";

export type ScoreSource = "lpi" | "cape";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function scoreFromLPI(lpi: number | null | undefined): number {
  if (lpi == null || Number.isNaN(lpi) || lpi < 0.5) return 0;
  if (lpi >= 10) return 95;
  if (lpi >= 8) return 85;
  if (lpi >= 5) return 65;
  if (lpi >= 2) return 35;
  return Math.round((lpi / 0.5) * 5 + 5);
}

export function scoreFromCAPE(cape: number | null | undefined): number {
  if (cape == null || Number.isNaN(cape) || cape <= 0) return 0;
  if (cape >= 4500) return 95;
  if (cape >= 2500) return 80;
  if (cape >= 1500) return 65;
  if (cape >= 1000) return 50;
  if (cape >= 500) return 35;
  if (cape >= 300) return 20;
  return 0;
}

export function liFactor(li: number | null | undefined): number {
  if (li == null || Number.isNaN(li) || li >= 999) return 1.0;
  if (li >= 2) return 0.6;
  if (li >= 0) return 0.85;
  if (li >= -2) return 1.0;
  if (li >= -6) return 1.25;
  return 1.5;
}

export function cinFactor(
  cin: number | null | undefined,
  lpi: number | null | undefined,
): number {
  if (cin == null || Number.isNaN(cin)) return 1.0;
  const absCin = Math.abs(cin);
  let raw: number;
  if (absCin <= 10) raw = 1.0;
  else if (absCin <= 50) raw = 0.85;
  else if (absCin <= 100) raw = 0.65;
  else if (absCin <= 200) raw = 0.3;
  else raw = 0.05;
  const lpiVal = typeof lpi === "number" && !Number.isNaN(lpi) ? lpi : 0;
  if (lpiVal >= 5) return Math.max(raw, 0.9);
  if (lpiVal >= 2) return Math.max(raw, 0.6);
  return raw;
}

export function shearFactor(shearKmh: number | null | undefined): number {
  if (shearKmh == null || Number.isNaN(shearKmh) || shearKmh <= 0) return 1.0;
  if (shearKmh >= 70) return 1.15;
  if (shearKmh >= 50) return 1.08;
  if (shearKmh >= 35) return 1.03;
  return 1.0;
}

export function gustBonus(gustKmh: number | null | undefined): number {
  const g = typeof gustKmh === "number" && !Number.isNaN(gustKmh) ? gustKmh : 0;
  if (g < 50) return 0;
  return Math.min(10, ((g - 50) / 50) * 10);
}

export function precipBonus(mmPerHour: number | null | undefined): number {
  const p = typeof mmPerHour === "number" && !Number.isNaN(mmPerHour) ? mmPerHour : 0;
  if (p < 10) return 0;
  if (p >= 30) return 8;
  return 5;
}

export function daytimeFactor(
  isoTime: string,
  lpi: number | null | undefined,
  shearKmh: number | null | undefined,
): number {
  const lpiVal = typeof lpi === "number" && !Number.isNaN(lpi) ? lpi : 0;
  const shearVal = typeof shearKmh === "number" && !Number.isNaN(shearKmh) ? shearKmh : 0;
  if (lpiVal >= 3 || shearVal >= 50) return 1.0;
  const h = new Date(isoTime).getHours();
  if (h >= 0 && h <= 5) return 0.55;
  if (h >= 6 && h <= 9) return 0.8;
  if (h >= 10 && h <= 19) return 1.0;
  if (h >= 20 && h <= 22) return 0.8;
  return 0.6;
}

export interface HourSignals {
  isoTime: string;
  lpi?: number | null;
  cape?: number | null;
  li?: number | null;
  cin?: number | null;
  gustKmh?: number | null;
  shearKmh?: number | null;
  precipMmH?: number | null;
}

export function computeHourScore(s: HourSignals): {
  score: number;
  source: ScoreSource;
  dayPeakScore: number;
} {
  const cape = scoreFromCAPE(s.cape);
  const lpi = scoreFromLPI(s.lpi);
  const base = Math.max(cape, lpi);
  const additive = base + gustBonus(s.gustKmh) + precipBonus(s.precipMmH);
  const factors = liFactor(s.li) * cinFactor(s.cin, s.lpi) * shearFactor(s.shearKmh);
  const dayPeakScore = Math.round(clamp(additive * factors, 0, 100));
  const score = Math.round(
    clamp(additive * factors * daytimeFactor(s.isoTime, s.lpi, s.shearKmh), 0, 100),
  );
  const lpiVal = typeof s.lpi === "number" && !Number.isNaN(s.lpi) ? s.lpi : 0;
  const source: ScoreSource = lpiVal >= 0.5 ? "lpi" : "cape";
  return { score, source, dayPeakScore };
}

export function approxShear(
  wind10m: number | null | undefined,
  wind500: number | null | undefined,
): number | null {
  if (wind10m == null || wind500 == null) return null;
  if (Number.isNaN(wind10m) || Number.isNaN(wind500)) return null;
  return Math.abs(wind500 - wind10m);
}
