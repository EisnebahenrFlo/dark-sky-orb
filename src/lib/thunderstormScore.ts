/**
 * Single source of truth for thunderstorm composite score.
 *
 * Used by:
 *   - src/hooks/useThunderstormRisk.ts (UI/Hero/Risiken)
 *   - api/_lib/thunderstormScore.ts   (Server-Fallback im KI-Wetterhinweis)
 *
 * Wenn du hier etwas änderst, halte api/_lib/thunderstormScore.ts synchron
 * und erhöhe THUNDERSTORM_SCORE_VERSION in beiden Dateien.
 *
 * Operationelle Schwellen orientiert an:
 *   - NWS Convective Outlook (CAPE/LI/Shear-Bänder)
 *   - DWD ICON-D2 LPI-Bulletin (Lightning Potential)
 *   - Markowski/Richardson "Mesoscale Meteorology" (Shear & CIN-Gating)
 */

export const THUNDERSTORM_SCORE_VERSION = "2026-05-30";

export type ThunderstormLevel = "none" | "low" | "moderate" | "high" | "extreme";
export type ScoreSource = "lpi" | "cape";

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

export function labelForLevel(level: ThunderstormLevel): string {
  return LEVEL_LABEL[level];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** LPI 0..10+ → 0..100. Ab 0.5 messbar, 8+ = sehr starke Lage. */
export function scoreFromLPI(lpi: number | null | undefined): number {
  if (lpi == null || Number.isNaN(lpi) || lpi < 0.5) return 0;
  // 0.5 → 10, 2 → 35, 5 → 65, 8 → 85, 10+ → 95
  if (lpi >= 10) return 95;
  if (lpi >= 8) return 85;
  if (lpi >= 5) return 65;
  if (lpi >= 2) return 35;
  return Math.round((lpi / 0.5) * 5 + 5);
}

/** CAPE in J/kg → 0..100. Linear bis 4500 J/kg (MCS/Derecho). */
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

/**
 * Lifted Index → Multiplikator.
 *   LI >= 0    stabil          0.6/0.85
 *   LI -2..0   leicht instabil 1.0
 *   LI -6..-2  instabil        1.25
 *   LI < -6    extrem labil    1.5
 */
export function liFactor(li: number | null | undefined): number {
  if (li == null || Number.isNaN(li) || li >= 999) return 1.0;
  if (li >= 2) return 0.6;
  if (li >= 0) return 0.85;
  if (li >= -2) return 1.0;
  if (li >= -6) return 1.25;
  return 1.5;
}

/**
 * CIN-Gate. Bei modelliertem Blitz (LPI ≥ 5) ist Konvektion bereits ausgelöst —
 * dann darf CIN nicht mehr stark dämpfen (Floor 0.9).
 */
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

/**
 * 0-6 km Bulk Shear ≈ |Wind_500hPa − Wind_10m| in km/h.
 * >= 35 kn (≈ 65 km/h) gilt als Schwelle für organisierte Konvektion/Superzellen.
 */
export function shearFactor(shearKmh: number | null | undefined): number {
  if (shearKmh == null || Number.isNaN(shearKmh) || shearKmh <= 0) return 1.0;
  if (shearKmh >= 70) return 1.15;
  if (shearKmh >= 50) return 1.08;
  if (shearKmh >= 35) return 1.03;
  return 1.0;
}

/**
 * Linearer Böen-Bonus 0..+10 ab 50 km/h Böen.
 * Squall-Lagen (80–110 km/h) → +10.
 */
export function gustBonus(gustKmh: number | null | undefined): number {
  const g = typeof gustKmh === "number" && !Number.isNaN(gustKmh) ? gustKmh : 0;
  if (g < 50) return 0;
  return Math.min(10, ((g - 50) / 50) * 10);
}

/** Starkregen-Bonus: ab 10 mm/h +5 (Starkregen-Gewitter). */
export function precipBonus(mmPerHour: number | null | undefined): number {
  const p = typeof mmPerHour === "number" && !Number.isNaN(mmPerHour) ? mmPerHour : 0;
  if (p < 10) return 0;
  if (p >= 30) return 8;
  return 5;
}

/**
 * Tageszeit-Faktor. Konvektion durch Tageserwärmung.
 * Override bei LPI ≥ 3 ODER Shear ≥ 50 km/h (organisierte/frontale Lage → auch nachts).
 */
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

export interface HourScore {
  score: number;
  source: ScoreSource;
  dayPeakScore: number;
}

/**
 * Composite-Score für eine Stunde.
 *   base   = max(scoreFromCAPE, scoreFromLPI)
 *   + gustBonus + precipBonus
 *   × liFactor × cinFactor × shearFactor × daytimeFactor
 *
 * `dayPeakScore` ignoriert daytimeFactor — sinnvoll für Tages-Max in der Wochenansicht.
 */
export function computeHourScore(s: HourSignals): HourScore {
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

/**
 * Shear aus 10m- und 500hPa-Wind approximieren (km/h).
 * Wenn 500hPa fehlt, gib null — `shearFactor(null)` ist dann neutral.
 */
export function approxShear(
  wind10m: number | null | undefined,
  wind500: number | null | undefined,
): number | null {
  if (wind10m == null || wind500 == null) return null;
  if (Number.isNaN(wind10m) || Number.isNaN(wind500)) return null;
  return Math.abs(wind500 - wind10m);
}
