import type { RainbowNowcastItem, RainbowPrecipType } from "@/hooks/useRainbowNowcast";

export type PrecipKind = "rain" | "snow" | "ice" | "none";

export interface NowcastPoint {
  x: number;
  y: number;
  rate: number;
  type: PrecipKind;
  tsBegin: number;
  minOffset: number;
}

export interface NowcastSegment {
  type: PrecipKind;
  points: NowcastPoint[];
}

export interface NowcastMarker {
  x: number;
  label: "beginnt" | "endet";
}

export interface NowcastSummary {
  text: string;
  warn: boolean;
}

export function normalizeType(t: RainbowPrecipType | string | undefined | null): PrecipKind {
  if (t === "rain" || t === "snow" || t === "ice") return t;
  return "none";
}

const safeRate = (r: unknown): number => {
  const n = typeof r === "number" ? r : Number(r);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};

/** Compute the y-axis ceiling so even small drizzle is visible. Always ≥ 0.5 mm/h. */
export function computeRateCeiling(points: { rate: number }[]): number {
  let peak = 0;
  for (const p of points) if (p.rate > peak) peak = p.rate;
  if (peak <= 0) return 1;
  if (peak <= 0.5) return 0.5;
  if (peak <= 1) return 1;
  if (peak <= 2) return 2;
  if (peak <= 5) return 5;
  if (peak <= 10) return 10;
  if (peak <= 20) return 20;
  return Math.ceil(peak / 10) * 10;
}

export function buildPoints(
  items: RainbowNowcastItem[] | null | undefined,
  nowSec: number,
  minutes: number,
  vbW: number,
  vbH: number,
  rateCeiling: number,
): NowcastPoint[] {
  if (!Array.isArray(items) || items.length === 0 || minutes <= 0 || rateCeiling <= 0) return [];
  const endSec = nowSec + minutes * 60;
  const filtered = items
    .filter(
      (f) =>
        f &&
        typeof f.timestampBegin === "number" &&
        f.timestampBegin >= nowSec - 60 &&
        f.timestampBegin <= endSec,
    )
    .sort((a, b) => a.timestampBegin - b.timestampBegin);

  return filtered.map((f) => {
    const minOffset = Math.max(0, (f.timestampBegin - nowSec) / 60);
    const rate = safeRate(f.precipRate);
    const rateClamped = Math.min(rate, rateCeiling);
    const x = (minOffset / minutes) * vbW;
    const y = vbH - (rateClamped / rateCeiling) * vbH;
    return {
      x,
      y,
      rate,
      type: normalizeType(f.precipType),
      tsBegin: f.timestampBegin,
      minOffset,
    };
  });
}

export function buildSegments(points: NowcastPoint[]): NowcastSegment[] {
  const segs: NowcastSegment[] = [];
  for (const p of points) {
    const last = segs[segs.length - 1];
    if (last && last.type === p.type) {
      last.points.push(p);
    } else {
      const seed = last ? [last.points[last.points.length - 1], p] : [p];
      segs.push({ type: p.type, points: [...seed] });
    }
  }
  return segs;
}

const isPrecip = (p: NowcastPoint) => p.type !== "none" && p.rate > 0;

export function buildMarkers(points: NowcastPoint[], minutes: number, vbW: number): NowcastMarker[] {
  if (points.length === 0 || minutes <= 0) return [];
  const out: NowcastMarker[] = [];
  let wasPrecip = isPrecip(points[0]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const nowPrecip = isPrecip(p);
    if (nowPrecip !== wasPrecip) {
      out.push({ x: (p.minOffset / minutes) * vbW, label: nowPrecip ? "beginnt" : "endet" });
      wasPrecip = nowPrecip;
    }
  }
  return out;
}

export function findPeak(points: NowcastPoint[]): NowcastPoint | null {
  let best: NowcastPoint | null = null;
  for (const p of points) {
    if (!best || p.rate > best.rate) best = p;
  }
  return best && best.rate > 0 ? best : null;
}

/** Format a UNIX-seconds timestamp as "HH:MM" using the local timezone. */
export function formatClockTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function buildSummary(
  points: NowcastPoint[],
  minutes: number,
  nowSec: number = Date.now() / 1000,
): NowcastSummary {
  if (points.length === 0) return { text: "Kein Niederschlag erwartet", warn: false };
  if (points.some((p) => p.type === "ice" && p.rate > 0)) {
    return { text: "⚠️ Gefrierender Regen — Glatteisgefahr", warn: true };
  }
  if (!points.some(isPrecip)) {
    return {
      text: `Kein Niederschlag in den nächsten ${minutes < 60 ? minutes + " Min" : minutes / 60 + " h"}`,
      warn: false,
    };
  }
  const first = points[0];
  if (isPrecip(first)) {
    let endIdx = points.length;
    for (let i = 1; i < points.length; i++) {
      if (!isPrecip(points[i])) {
        endIdx = i;
        break;
      }
    }
    const label = first.type === "snow" ? "Schnee" : first.type === "ice" ? "Eis" : "Regen";
    if (endIdx < points.length) {
      const endTs = points[endIdx].tsBegin;
      return { text: `${label} endet um ${formatClockTime(endTs)} Uhr`, warn: false };
    }
    return { text: `${label} hält länger als ${minutes / 60}h an`, warn: false };
  }
  const start = points.find(isPrecip)!;
  const label = start.type === "snow" ? "Schnee" : start.type === "ice" ? "Eis" : "Regen";
  return { text: `${label} beginnt um ${formatClockTime(start.tsBegin)} Uhr`, warn: false };
}


export function formatOffset(min: number): string {
  if (min === 0) return "Jetzt";
  if (min < 60) return `+${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `+${h}h`;
  return `+${h}:${String(m).padStart(2, "0")}h`;
}

export function formatRate(rate: number): string {
  if (rate < 0.1) return "< 0,1 mm/h";
  if (rate < 1) return `${rate.toFixed(1).replace(".", ",")} mm/h`;
  return `${rate.toFixed(1).replace(".", ",")} mm/h`;
}

export function intensityLabel(rate: number): string {
  if (rate < 0.1) return "vernachlässigbar";
  if (rate < 0.5) return "Nieselregen";
  if (rate < 2.5) return "leicht";
  if (rate < 7.5) return "mäßig";
  if (rate < 15) return "stark";
  return "sehr stark";
}

export type IntensityBucket = "none" | "drizzle" | "light" | "moderate" | "heavy" | "extreme";

export function intensityBucket(rate: number): IntensityBucket {
  if (!Number.isFinite(rate) || rate <= 0) return "none";
  if (rate < 0.1) return "none";
  if (rate < 0.5) return "drizzle";
  if (rate < 2.5) return "light";
  if (rate < 7.5) return "moderate";
  if (rate < 15) return "heavy";
  return "extreme";
}

export interface NowcastCell {
  /** Minutes from now this cell starts (0, 10, 20, ...). */
  minOffset: number;
  /** Rate in mm/h; 0 when there is no data or no precip. */
  rate: number;
  /** Precip kind; "none" when no data or no precip. */
  type: PrecipKind;
  bucket: IntensityBucket;
  /** True when no forecast item covered this slot. */
  missing: boolean;
}

/**
 * Build a regular grid of `slotMin`-wide cells covering `minutes` minutes
 * starting now. Forecast items are slotted into the nearest start; gaps
 * become `missing` cells so the strip width is always predictable.
 */
export function buildCells(
  items: RainbowNowcastItem[] | null | undefined,
  nowSec: number,
  minutes: number,
  slotMin = 10,
): NowcastCell[] {
  const count = Math.max(0, Math.floor(minutes / slotMin));
  const cells: NowcastCell[] = Array.from({ length: count }, (_, i) => ({
    minOffset: i * slotMin,
    rate: 0,
    type: "none",
    bucket: "none",
    missing: true,
  }));
  if (!Array.isArray(items)) return cells;

  for (const f of items) {
    if (!f || typeof f.timestampBegin !== "number") continue;
    const offsetMin = (f.timestampBegin - nowSec) / 60;
    if (offsetMin < -slotMin || offsetMin >= minutes) continue;
    const idx = Math.max(0, Math.min(count - 1, Math.floor(offsetMin / slotMin)));
    const rate = safeRate(f.precipRate);
    const type = normalizeType(f.precipType);
    cells[idx] = {
      minOffset: idx * slotMin,
      rate,
      type,
      bucket: intensityBucket(rate),
      missing: false,
    };
  }
  return cells;
}

