/**
 * Multi-model ensemble: takes Open-Meteo responses that contain per-model
 * suffixed variables (e.g. `temperature_2m_icon_d2`, `temperature_2m_ecmwf_ifs025`)
 * and folds them into a single consensus series + confidence score.
 *
 * Aggregation rules per variable kind:
 *   - "median"        : weighted median across models (robust to outliers)
 *   - "mean"          : arithmetic mean of non-null values
 *   - "max"           : maximum (worst-case for CAPE / thunder)
 *   - "min"           : minimum (worst-case for Lifted Index)
 *   - "circular_mean" : circular mean (wind direction degrees)
 *   - "severity_mode" : weighted mode for weather codes, tie-break by severity
 *
 * Confidence (0..100) is derived per hour from temperature stddev and PoP spread.
 */

export type EnsembleMode =
  | "median"
  | "mean"
  | "max"
  | "min"
  | "circular_mean"
  | "severity_mode";

/** Higher = more trusted (resolution / regional fit). */
const MODEL_WEIGHT: Record<string, number> = {
  // High-res local models
  icon_d2: 1.0,
  icon_ch2: 1.0,
  italia_meteo_arpae_icon_2i: 1.0,
  // Regional
  icon_eu: 0.7,
  knmi_harmonie_arome_europe: 0.65,
  // Global
  ecmwf_ifs025: 0.6,
  icon_seamless: 0.55,
  gfs_seamless: 0.4,
};

const DEFAULT_WEIGHT = 0.5;

function weightOf(modelId: string): number {
  return MODEL_WEIGHT[modelId] ?? DEFAULT_WEIGHT;
}

/** WMO severity ordering for tie-breaking. Higher = more severe. */
function codeSeverity(code: number): number {
  if (code >= 95) return 100; // thunder
  if (code >= 80) return 80; // showers
  if (code >= 71 && code <= 77) return 75; // snow
  if (code >= 51 && code <= 67) return 60; // rain / drizzle
  if (code === 45 || code === 48) return 40; // fog
  if (code === 3) return 20; // overcast
  if (code === 2) return 10; // partly cloudy
  if (code === 1) return 5;
  return 0; // clear
}

function weightedMedian(vals: number[], weights: number[]): number {
  const pairs = vals
    .map((v, i) => ({ v, w: weights[i] }))
    .filter((p) => Number.isFinite(p.v) && p.w > 0)
    .sort((a, b) => a.v - b.v);
  if (pairs.length === 0) return NaN;
  const total = pairs.reduce((s, p) => s + p.w, 0);
  let cum = 0;
  for (const p of pairs) {
    cum += p.w;
    if (cum >= total / 2) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

function circularMean(vals: number[], weights: number[]): number {
  let x = 0;
  let y = 0;
  let wsum = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const w = weights[i];
    if (!Number.isFinite(v) || w <= 0) continue;
    const rad = (v * Math.PI) / 180;
    x += Math.cos(rad) * w;
    y += Math.sin(rad) * w;
    wsum += w;
  }
  if (wsum === 0) return NaN;
  const deg = (Math.atan2(y / wsum, x / wsum) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function severityMode(vals: number[], weights: number[]): number {
  // "severity_mode" name kept for API stability, but logic is now consensus-first:
  //   1. Bucket codes, summing model weights.
  //   2. Pick the bucket with the highest summed weight (= lokales Hochauflösungs­modell
  //      wie ICON-D2 schlägt globale Modelle wie ECMWF/GFS, die Cirrus-/Mittelwolken
  //      systematisch überschätzen).
  //   3. Severity wird nur als Tie-Breaker bei *echtem* Gleichstand (Δgewicht < 5 %)
  //      benutzt — und auch dann nur, wenn der schwerere Code wirklich gefährlich ist
  //      (Niederschlag/Gewitter ≥ 51). Sonst bleibt der weniger pessimistische Code.
  const buckets = new Map<number, { weight: number; severity: number; count: number }>();
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const w = weights[i];
    if (!Number.isFinite(v) || w <= 0) continue;
    const code = Math.round(v);
    const cur = buckets.get(code);
    if (cur) {
      cur.weight += w;
      cur.count += 1;
    } else {
      buckets.set(code, { weight: w, severity: codeSeverity(code), count: 1 });
    }
  }
  if (buckets.size === 0) return NaN;
  const totalWeight = Array.from(buckets.values()).reduce((s, b) => s + b.weight, 0);
  let best: { code: number; weight: number; severity: number; count: number } | null = null;
  for (const [code, info] of buckets) {
    if (!best) {
      best = { code, ...info };
      continue;
    }
    const dw = info.weight - best.weight;
    const closeEnough = Math.abs(dw) < 0.05 * totalWeight;
    if (dw > 0 && !closeEnough) {
      best = { code, ...info };
    } else if (closeEnough) {
      // Tie-Break 1: häufiger gemeldet gewinnt
      if (info.count > best.count) {
        best = { code, ...info };
      } else if (info.count === best.count) {
        // Tie-Break 2: nur dann zum schwereren Code wechseln, wenn dieser
        // wirklich Niederschlag/Gewitter (≥ 51) markiert.
        if (info.severity > best.severity && code >= 51) {
          best = { code, ...info };
        }
      }
    }
  }
  return best!.code;
}

export function aggregateScalar(
  vals: Array<number | null | undefined>,
  modelIds: string[],
  mode: EnsembleMode,
): number | null {
  const cleanV: number[] = [];
  const cleanW: number[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v == null || !Number.isFinite(v)) continue;
    cleanV.push(Number(v));
    cleanW.push(weightOf(modelIds[i]));
  }
  if (cleanV.length === 0) return null;
  let out: number;
  switch (mode) {
    case "median":
      out = weightedMedian(cleanV, cleanW);
      break;
    case "mean":
      out = cleanV.reduce((s, v) => s + v, 0) / cleanV.length;
      break;
    case "max":
      out = Math.max(...cleanV);
      break;
    case "min":
      out = Math.min(...cleanV);
      break;
    case "circular_mean":
      out = circularMean(cleanV, cleanW);
      break;
    case "severity_mode":
      out = severityMode(cleanV, cleanW);
      break;
  }
  return Number.isFinite(out) ? out : null;
}

export function aggregateSeries(
  perModel: Array<{ id: string; series: Array<number | null | undefined> | undefined }>,
  mode: EnsembleMode,
): { values: number[]; counts: number[] } {
  // Determine length from first defined series
  const len = perModel.reduce((m, p) => Math.max(m, p.series?.length ?? 0), 0);
  const values: number[] = new Array(len).fill(NaN);
  const counts: number[] = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    const vals: Array<number | null | undefined> = [];
    const ids: string[] = [];
    let count = 0;
    for (const p of perModel) {
      const v = p.series?.[i];
      vals.push(v);
      ids.push(p.id);
      if (v != null && Number.isFinite(v)) count++;
    }
    const agg = aggregateScalar(vals, ids, mode);
    values[i] = agg ?? NaN;
    counts[i] = count;
  }
  return { values, counts };
}

function stddev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  return Math.sqrt(variance);
}

/**
 * Per-hour spread: temperature stddev (K) and PoP min/max spread (%).
 * Used both for confidence and for tooltip text.
 */
export function computeSpread(
  perModelTemps: Array<{ id: string; series: number[] | undefined }>,
  perModelPop: Array<{ id: string; series: number[] | undefined }>,
): { temp: number[]; pop: number[] } {
  const len = perModelTemps.reduce((m, p) => Math.max(m, p.series?.length ?? 0), 0);
  const temp: number[] = new Array(len).fill(0);
  const pop: number[] = new Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    const t: number[] = [];
    const p: number[] = [];
    for (const m of perModelTemps) {
      const v = m.series?.[i];
      if (v != null && Number.isFinite(v)) t.push(v);
    }
    for (const m of perModelPop) {
      const v = m.series?.[i];
      if (v != null && Number.isFinite(v)) p.push(v);
    }
    temp[i] = stddev(t);
    pop[i] = p.length > 0 ? Math.max(...p) - Math.min(...p) : 0;
  }
  return { temp, pop };
}

/** Map spread to a 0..100 confidence score. */
export function confidenceFromSpread(tempStd: number, popSpread: number, modelCount: number): number {
  if (modelCount <= 1) return 50;
  // Temperature spread: 0K -> 0 penalty, 4K -> 60 penalty
  const tempPenalty = Math.min(60, (tempStd / 4) * 60);
  // PoP spread: 0% -> 0, 100% -> 40 penalty
  const popPenalty = Math.min(40, (popSpread / 100) * 40);
  return Math.max(0, Math.min(100, Math.round(100 - tempPenalty - popPenalty)));
}

export function confidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function confidenceLabel(score: number): string {
  const l = confidenceLevel(score);
  if (l === "high") return "Hohe Sicherheit";
  if (l === "medium") return "Mittlere Sicherheit";
  return "Modelle uneinig";
}

/** Field -> aggregation mode for a model ensemble. */
export const HOURLY_AGG: Record<string, EnsembleMode> = {
  temperature_2m: "median",
  apparent_temperature: "median",
  precipitation: "mean",
  precipitation_probability: "mean",
  weather_code: "severity_mode",
  wind_speed_10m: "median",
  wind_gusts_10m: "median",
  wind_direction_10m: "circular_mean",
  cloud_cover: "median",
  cloud_cover_low: "median",
  cloud_cover_mid: "median",
  cloud_cover_high: "median",
  relative_humidity_2m: "median",
  uv_index: "mean",
  snowfall: "mean",
  visibility: "median",
  wet_bulb_temperature_2m: "median",
  freezing_level_height: "median",
  dewpoint_2m: "median",
  cape: "max",
  lifted_index: "min",
  convective_inhibition: "min",
  lightning_potential: "max",
  pressure_msl: "median",
  // Pressure-level fields -> median
  temperature_850hPa: "median",
  temperature_700hPa: "median",
  temperature_500hPa: "median",
  temperature_300hPa: "median",
  geopotential_height_500hPa: "median",
  geopotential_height_850hPa: "median",
  wind_speed_850hPa: "median",
  wind_direction_850hPa: "circular_mean",
  wind_speed_500hPa: "median",
  wind_direction_500hPa: "circular_mean",
  wind_speed_300hPa: "median",
  wind_direction_300hPa: "circular_mean",
  relative_humidity_850hPa: "median",
  relative_humidity_700hPa: "median",
  vertical_velocity_700hPa: "median",
};

export const CURRENT_AGG: Record<string, EnsembleMode> = {
  temperature_2m: "median",
  apparent_temperature: "median",
  relative_humidity_2m: "median",
  weather_code: "severity_mode",
  wind_speed_10m: "median",
  wind_gusts_10m: "median",
  wind_direction_10m: "circular_mean",
  pressure_msl: "median",
  precipitation: "mean",
  cloud_cover: "median",
};

/**
 * Build merged hourly/current blocks + spread/confidence metadata from a
 * raw Open-Meteo response that used `&models=a,b,c` (suffixed variables).
 *
 * Returns merged objects where each base variable key carries the consensus
 * values. Original `_<model>` suffixed keys are removed for cleanliness.
 */
export interface EnsembleResult {
  hourly: Record<string, unknown>;
  current: Record<string, unknown>;
  meta: {
    models: string[];
    hourlyConfidence: number[];
    currentConfidence: number;
    spread: { temp: number[]; pop: number[] };
    activeModelCounts: number[];
  };
}

export function buildEnsemble(
  rawHourly: Record<string, unknown> | undefined,
  rawCurrent: Record<string, unknown> | undefined,
  modelIds: string[],
): EnsembleResult {
  const hourlyOut: Record<string, unknown> = { time: rawHourly?.time ?? [] };
  const currentOut: Record<string, unknown> = { time: rawCurrent?.time };

  // Hourly aggregation
  for (const [field, mode] of Object.entries(HOURLY_AGG)) {
    const perModel = modelIds.map((id) => ({
      id,
      series: (rawHourly?.[`${field}_${id}`] as number[] | undefined) ?? undefined,
    }));
    const hasAny = perModel.some((p) => Array.isArray(p.series) && p.series.length > 0);
    if (!hasAny) {
      // Fallback to un-suffixed (single-model response)
      const single = rawHourly?.[field] as number[] | undefined;
      if (single) hourlyOut[field] = single;
      continue;
    }
    const { values } = aggregateSeries(perModel, mode);
    hourlyOut[field] = values.map((v) => (Number.isFinite(v) ? v : null));
  }

  // Carry over any extra hourly fields that aren't ensembled (e.g. is_day stays first)
  if (rawHourly) {
    const isDay = (rawHourly[`is_day_${modelIds[0]}`] ?? rawHourly.is_day) as number[] | undefined;
    if (isDay) hourlyOut.is_day = isDay;
  }

  // Current aggregation (scalars)
  for (const [field, mode] of Object.entries(CURRENT_AGG)) {
    const vals = modelIds.map((id) => rawCurrent?.[`${field}_${id}`] as number | undefined);
    const hasAny = vals.some((v) => v != null && Number.isFinite(v));
    if (!hasAny) {
      const single = rawCurrent?.[field];
      if (single != null) currentOut[field] = single;
      continue;
    }
    const agg = aggregateScalar(vals, modelIds, mode);
    if (agg != null) currentOut[field] = agg;
  }
  // is_day passthrough
  const curIsDay =
    (rawCurrent?.[`is_day_${modelIds[0]}`] as number | undefined) ?? (rawCurrent?.is_day as number | undefined);
  if (curIsDay != null) currentOut.is_day = curIsDay;

  // Spread + confidence from temperature and PoP
  const tempSeries = modelIds.map((id) => ({
    id,
    series: rawHourly?.[`temperature_2m_${id}`] as number[] | undefined,
  }));
  const popSeries = modelIds.map((id) => ({
    id,
    series: rawHourly?.[`precipitation_probability_${id}`] as number[] | undefined,
  }));
  const spread = computeSpread(tempSeries, popSeries);

  const activeModelCounts: number[] = (hourlyOut.time as string[]).map((_, i) => {
    let c = 0;
    for (const s of tempSeries) {
      const v = s.series?.[i];
      if (v != null && Number.isFinite(v)) c++;
    }
    return c;
  });

  // Per-Stunde Code-Disagreement: wie viele *unterschiedliche* weather_codes liefern die Modelle?
  const codeDisagreement: number[] = (hourlyOut.time as string[]).map((_, i) => {
    const codes = new Set<number>();
    for (const id of modelIds) {
      const arr = rawHourly?.[`weather_code_${id}`] as number[] | undefined;
      const v = arr?.[i];
      if (v != null && Number.isFinite(v)) codes.add(Math.round(v));
    }
    return codes.size; // 1 = alle einig, 4 = volle Uneinigkeit
  });

  const hourlyConfidence = spread.temp.map((t, i) => {
    const base = confidenceFromSpread(t, spread.pop[i] ?? 0, activeModelCounts[i] ?? 1);
    // Bestrafe Code-Uneinigkeit (jeder zusätzliche unterschiedliche Code = -10)
    const codePenalty = Math.max(0, (codeDisagreement[i] - 1) * 10);
    let score = Math.max(0, base - codePenalty);
    // Clamp: wenn nur 1 Modell aktiv ist, ist hohe Sicherheit nicht begründbar
    if ((activeModelCounts[i] ?? 1) < 2) score = Math.min(score, 60);
    return score;
  });

  // Current confidence: bevorzugt aus current-Block; sonst Mittel der ersten 3 Stunden
  // (statt nur Stunde 0 — die hat oft Spread 0 und führt fälschlich zu 100 %).
  const currentTemps = modelIds
    .map((id) => rawCurrent?.[`temperature_2m_${id}`] as number | undefined)
    .filter((v): v is number => v != null && Number.isFinite(v));
  let currentConfidence: number;
  if (currentTemps.length >= 2) {
    currentConfidence = confidenceFromSpread(stddev(currentTemps), spread.pop[0] ?? 0, currentTemps.length);
    // Code-Disagreement der aktuellen Stunde auch hier einrechnen
    currentConfidence = Math.max(0, currentConfidence - Math.max(0, (codeDisagreement[0] - 1) * 10));
  } else {
    const first3 = hourlyConfidence.slice(0, 3).filter((v) => Number.isFinite(v));
    currentConfidence = first3.length
      ? Math.round(first3.reduce((s, v) => s + v, 0) / first3.length)
      : 50;
  }
  if ((activeModelCounts[0] ?? 1) < 2) currentConfidence = Math.min(currentConfidence, 60);

  return {
    hourly: hourlyOut,
    current: currentOut,
    meta: {
      models: modelIds,
      hourlyConfidence,
      currentConfidence,
      spread,
      activeModelCounts,
    },
  };
}
