// Vercel Serverless Function – KI-Wetterhinweise (vormals "KI-Warnungen").
// Composite Gewitter-Score teilt sich Frontend + Server (api/_lib/thunderstormScore.ts).
// Schwellen für Wind/Schnee/Glätte/Hagel sind an DWD-Stufen angelehnt.
import { getCached, setCached, isFresh, ageMinutes } from "./_lib/cache.js";
import {
  approxShear,
  computeHourScore,
  THUNDERSTORM_SCORE_VERSION,
} from "./_lib/thunderstormScore.js";

// Stufen (Score-basiert, an DWD Stufen 1–4 angelehnt):
//   1–34   → warnung  (gelb)   = DWD Stufe 1
//   35–54  → markant  (orange) = DWD Stufe 2
//   55–74  → unwetter (rot)    = DWD Stufe 3
//   75–100 → extrem   (lila)   = DWD Stufe 4
type Stufe = "warnung" | "markant" | "unwetter" | "extrem";

const STUFE_RANK: Record<Stufe, number> = { warnung: 1, markant: 2, unwetter: 3, extrem: 4 };
const RANK_STUFE: Record<number, Stufe> = { 1: "warnung", 2: "markant", 3: "unwetter", 4: "extrem" };

function maxStufe(a: Stufe, b: Stufe): Stufe {
  return STUFE_RANK[a] >= STUFE_RANK[b] ? a : b;
}

function stufeColor(stufe: Stufe): "yellow" | "orange" | "red" | "purple" {
  if (stufe === "extrem") return "purple";
  if (stufe === "unwetter") return "red";
  if (stufe === "markant") return "orange";
  return "yellow";
}

type ErrorCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "INVALID_RESPONSE"
  | "BAD_REQUEST";

const FRESH_MS = 15 * 60 * 1000;
const RETRY_DELAYS_MS = [500, 1500, 4500];
const REQUEST_TIMEOUT_MS = 30_000;

function errorResponse(res: any, status: number, code: ErrorCode, error: string, details?: string) {
  return res.status(status).json({ error, code, ...(details ? { details } : {}) });
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getIndices(hourly: any, hours: number): number[] {
  const now = Date.now();
  return hourly.time
    .map((t: string, i: number) => ({ t: new Date(t).getTime(), i }))
    .filter((x: any) => x.t >= now && x.t <= now + hours * 3600 * 1000)
    .map((x: any) => x.i);
}

// -------------------- Gewitter-Score (Server-Fallback, Composite) --------------------

function computeServerStormScore(weatherData: any, hours = 6): number {
  const h = weatherData?.hourly;
  if (!h?.time) return 0;
  const nowMs = Date.now();
  let peak = 0;
  let counted = 0;
  for (let i = 0; i < h.time.length && counted < hours; i++) {
    const t = new Date(h.time[i]).getTime();
    if (t < nowMs) continue;
    const { score } = computeHourScore({
      isoTime: h.time[i],
      cape: h.cape?.[i],
      lpi: h.lightning_potential?.[i],
      li: h.lifted_index?.[i],
      cin: h.convective_inhibition?.[i],
      gustKmh: h.wind_gusts_10m?.[i],
      shearKmh: approxShear(h.wind_speed_10m?.[i], h.wind_speed_500hPa?.[i]),
      precipMmH: h.precipitation?.[i],
    });
    if (score > peak) peak = score;
    counted++;
  }
  return peak;
}

function stufeFromScore(score: number): Stufe {
  if (score >= 75) return "extrem";
  if (score >= 55) return "unwetter";
  if (score >= 35) return "markant";
  return "warnung";
}

function scoreLevelLabel(score: number): string {
  if (score >= 86) return "extrem";
  if (score >= 61) return "sehr_hoch";
  if (score >= 31) return "hoch";
  if (score >= 11) return "mäßig";
  if (score >= 1) return "schwach";
  return "kein";
}

function scoreToColor(score: number): string {
  if (score >= 86) return "purple";
  if (score >= 61) return "red";
  if (score >= 31) return "orange";
  if (score >= 11) return "yellow";
  return "green";
}

// -------------------- Hinweis-Detection --------------------

function detectWarnings(
  weatherData: any,
  windowHours: number,
  nowcast: any | null,
  stormScore = 0,
) {
  const warnings: any[] = [];
  const hourly = weatherData.hourly;
  if (!hourly?.time) return warnings;
  const idx = getIndices(hourly, windowHours);
  if (idx.length === 0) return warnings;

  const get = (arr: number[] | undefined, i: number, fallback = 0) =>
    typeof arr?.[i] === "number" ? (arr as number[])[i] : fallback;

  // ---- WIND (DWD Bft-Schwellen: 50/70/90/118) ----
  let maxGust = 0;
  for (const i of idx) maxGust = Math.max(maxGust, get(hourly.wind_gusts_10m, i, 0));
  if (maxGust >= 50) {
    const stufe: Stufe =
      maxGust >= 118 ? "extrem" : maxGust >= 90 ? "unwetter" : maxGust >= 70 ? "markant" : "warnung";
    warnings.push({ typ: "wind", stufe, max_value: Math.round(maxGust), unit: "km/h" });
  }

  // ---- STARKREGEN (hourly + Nowcast) ----
  // Nowcast: peak precipRate (mm/h) in den nächsten 60 Min.
  let nowcastPeakMmH = 0;
  const nowcastForecast: any[] = Array.isArray(nowcast?.forecast) ? nowcast.forecast : [];
  for (const slot of nowcastForecast.slice(0, 12)) {
    const rate = Number(slot?.precipRate ?? 0);
    if (Number.isFinite(rate)) nowcastPeakMmH = Math.max(nowcastPeakMmH, rate);
  }
  let max1h = nowcastPeakMmH;
  for (const i of idx) max1h = Math.max(max1h, get(hourly.precipitation, i, 0));
  // Rolling 12h-Summe (oder windowHours, je kleiner)
  const sumWindow = idx.reduce((s, i) => s + get(hourly.precipitation, i, 0), 0);
  if (max1h >= 5 || sumWindow >= 15) {
    const stufe: Stufe =
      max1h >= 40 ? "extrem" : max1h >= 25 ? "unwetter" : max1h >= 15 ? "markant" : "warnung";
    warnings.push({
      typ: "regen",
      stufe,
      max_1h: Math.round(max1h * 10) / 10,
      sum: Math.round(sumWindow * 10) / 10,
      nowcast_peak: Math.round(nowcastPeakMmH * 10) / 10,
      unit: "mm",
    });
  }

  // ---- SCHNEE — rolling 12h-Summe (DWD-Schema 10/20/40 cm/12h, vereinfacht 5/10/20) ----
  let maxSnow12 = 0;
  for (let k = 0; k < idx.length; k++) {
    let s = 0;
    for (let j = k; j < Math.min(idx.length, k + 12); j++) {
      s += get(hourly.snowfall, idx[j], 0);
    }
    if (s > maxSnow12) maxSnow12 = s;
  }
  if (maxSnow12 >= 5) {
    const stufe: Stufe =
      maxSnow12 >= 40 ? "extrem" : maxSnow12 >= 20 ? "unwetter" : maxSnow12 >= 10 ? "markant" : "warnung";
    warnings.push({ typ: "schnee", stufe, sum: Math.round(maxSnow12 * 10) / 10, unit: "cm/12h" });
  }

  // ---- GEWITTER (Composite-Score) ----
  let maxCape = 0;
  for (const i of idx) maxCape = Math.max(maxCape, get(hourly.cape, i, 0));
  if (stormScore >= 20) {
    warnings.push({
      typ: "gewitter",
      stufe: stufeFromScore(stormScore),
      score: stormScore,
      cape_max: Math.round(maxCape),
      unit: "score",
    });
  }

  // ---- HAGEL (WMO 96/99 ODER konvektive Hagel-Signatur) ----
  const codes = idx.map((i) => Math.round(get(hourly.weather_code, i, 0)));
  const hailCode = codes.some((c) => c === 96 || c === 99);
  let maxFreezingLow = Infinity;
  let maxConvCape = 0;
  for (const i of idx) {
    const fl = get(hourly.freezing_level_height, i, 9999);
    if (fl < maxFreezingLow) maxFreezingLow = fl;
    maxConvCape = Math.max(maxConvCape, get(hourly.cape, i, 0));
  }
  const convHail =
    stormScore >= 55 && maxConvCape >= 1500 && maxFreezingLow < 3500;
  if (hailCode || convHail) {
    const stufe: Stufe = stormScore >= 75 || hailCode ? "unwetter" : "markant";
    warnings.push({
      typ: "hagel",
      stufe,
      cape_max: Math.round(maxConvCape),
      freezing_level_min: Math.round(maxFreezingLow),
      unit: "m",
    });
  }

  // ---- HITZE (gefühlte Temp wäre besser, hier 2m-Temp) ----
  let maxTemp = -Infinity;
  for (const i of idx) maxTemp = Math.max(maxTemp, get(hourly.temperature_2m, i, -Infinity));
  if (Number.isFinite(maxTemp) && maxTemp >= 30) {
    const stufe: Stufe = maxTemp >= 38 ? "unwetter" : maxTemp >= 35 ? "markant" : "warnung";
    warnings.push({ typ: "hitze", stufe, max_value: Math.round(maxTemp), unit: "°C" });
  }

  // ---- FROST ----
  let minTemp = Infinity;
  for (const i of idx) minTemp = Math.min(minTemp, get(hourly.temperature_2m, i, Infinity));
  if (Number.isFinite(minTemp) && minTemp <= -5) {
    const stufe: Stufe = minTemp <= -15 ? "unwetter" : minTemp <= -10 ? "markant" : "warnung";
    warnings.push({ typ: "frost", stufe, min_value: Math.round(minTemp), unit: "°C" });
  }

  // ---- GLÄTTE (Code 56/57/66/67 ODER Wet-Bulb-basiert) ----
  const freezeCode = codes.some((c) => c === 56 || c === 57 || c === 66 || c === 67);
  let wetBulbGlaze = false;
  for (const i of idx) {
    const wb = hourly.wet_bulb_temperature_2m?.[i] ?? hourly.temperature_2m?.[i] - 2 ?? null;
    const p = get(hourly.precipitation, i, 0);
    if (typeof wb === "number" && wb <= 0 && p > 0.1) wetBulbGlaze = true;
  }
  if (freezeCode || wetBulbGlaze) {
    const stufe: Stufe = freezeCode ? "markant" : "warnung";
    warnings.push({ typ: "glätte", stufe });
  }

  return warnings.map((w) => ({ ...w, color: stufeColor(w.stufe) }));
}

// -------------------- Amtliche Warnungen einmischen --------------------

function officialTypeKey(rawType: unknown): string | null {
  if (typeof rawType !== "string") return null;
  const t = rawType.toLowerCase();
  if (t.includes("thunder") || t.includes("gewitter")) return "gewitter";
  if (t.includes("wind") || t.includes("sturm") || t.includes("gale") || t.includes("orkan")) return "wind";
  if (t.includes("rain") || t.includes("regen") || t.includes("flood") || t.includes("hochwasser")) return "regen";
  if (t.includes("snow") || t.includes("schnee")) return "schnee";
  if (t.includes("hail") || t.includes("hagel")) return "hagel";
  if (t.includes("ice") || t.includes("glät") || t.includes("frost glaze")) return "glätte";
  if (t.includes("heat") || t.includes("hitze")) return "hitze";
  if (t.includes("frost") || t.includes("cold")) return "frost";
  return null;
}

function officialLevelToStufe(level: unknown): Stufe {
  const n = typeof level === "number" ? level : Number(level);
  if (!Number.isFinite(n) || n <= 1) return "warnung";
  if (n >= 4) return "extrem";
  return RANK_STUFE[n] ?? "warnung";
}

function mergeOfficialIntoWarnings(warnings: any[], official: any[]): any[] {
  if (!Array.isArray(official) || official.length === 0) return warnings;
  const byType = new Map<string, any>();
  for (const w of warnings) byType.set(w.typ, w);

  for (const ow of official) {
    const key = officialTypeKey(ow?.type);
    if (!key) continue;
    const stufe = officialLevelToStufe(ow?.level);
    const existing = byType.get(key);
    if (existing) {
      existing.stufe = maxStufe(existing.stufe as Stufe, stufe);
      existing.color = stufeColor(existing.stufe);
      existing.official = true;
    } else {
      const fresh = {
        typ: key,
        stufe,
        official: true,
        color: stufeColor(stufe),
      } as any;
      warnings.push(fresh);
      byType.set(key, fresh);
    }
  }
  return warnings;
}

// -------------------- Kontext + Templates --------------------

function buildConvectiveContext(weatherData: any, windowHours: number) {
  const hourly = weatherData.hourly;
  if (!hourly?.time) return {};
  const idx = getIndices(hourly, windowHours);
  if (idx.length === 0) return {};
  let maxCape = 0, minLI = 999, minCIN = 0, maxLPI = 0, maxShear = 0;
  for (const i of idx) {
    maxCape = Math.max(maxCape, hourly.cape?.[i] ?? 0);
    minLI = Math.min(minLI, hourly.lifted_index?.[i] ?? 999);
    minCIN = Math.min(minCIN, hourly.convective_inhibition?.[i] ?? 0);
    maxLPI = Math.max(maxLPI, hourly.lightning_potential?.[i] ?? 0);
    const shear = approxShear(hourly.wind_speed_10m?.[i], hourly.wind_speed_500hPa?.[i]);
    if (typeof shear === "number") maxShear = Math.max(maxShear, shear);
  }
  return {
    cape_max_jkg: Math.round(maxCape),
    lifted_index_min: Math.round(minLI * 10) / 10,
    cin_min_jkg: Math.round(minCIN),
    lpi_max_jkg: Math.round(maxLPI * 10) / 10,
    wind_shear_max_kmh: Math.round(maxShear),
  };
}

const STATIC_PROMPT = `Du bist erfahrener Meteorologe und Wetter-Sicherheits-Kommunikator für DACH und Italien.

REGEL 0 (ABSOLUT): NIEMALS "LI=999", "LI nicht verfügbar", "Daten fehlen" o.ä. erwähnen. Wenn ein Wert fehlt, ignoriere ihn vollständig.

Du bekommst:
1. Rohe Stundenwerte der nächsten 12-48h (Temperatur, Niederschlag, Wind, CAPE, LI, LPI, Shear, Wettercode).
2. Einen FERTIG BERECHNETEN Gewitter-Score (Composite aus CAPE/LPI/LI/CIN/Shear/Tageszeit) — übernimm exakt.
3. Eine FERTIG BERECHNETE Liste von Hinweisen aus harten Schwellenwerten — das ist die einzige Quelle für warnungen_12h.
4. Konvektive Kontext-Metriken (CAPE, LI, CIN, LPI, Shear).
5. Amtliche Warnungen (DWD/MeteoAlarm) und Rainbow-Nowcast (Niederschlag nächste 2h).

DEINE AUFGABE FÜR warnungen_12h:
- Für jeden berechneten Hinweis formulierst du Titel und Beschreibung.
- Erfinde KEINE zusätzlichen Hinweise.
- typ, stufe, color und Messwerte übernimmst du EXAKT.
- Wenn warnungen leer → warnungen_12h: [].

TITEL-VORLAGEN:
- gewitter/warnung:  "Gewitter möglich"
- gewitter/markant:  "Starkes Gewitter möglich"
- gewitter/unwetter: "Unwetterhinweis Gewitter"
- gewitter/extrem:   "Extremes Gewitter"
- hagel/warnung:     "Hagel möglich"
- hagel/markant:     "Markanter Hagelschlag"
- hagel/unwetter:    "Unwetterhinweis Hagel"
- wind/warnung:      "Windböen erwartet"
- wind/markant:      "Markante Sturmböen"
- wind/unwetter:     "Sturm"
- wind/extrem:       "Orkan"
- regen/warnung:     "Regen möglich"
- regen/markant:     "Starkregen"
- regen/unwetter:    "Unwetterhinweis Starkregen"
- regen/extrem:      "Extremer Starkregen"
- schnee/warnung:    "Schneefall möglich"
- schnee/markant:    "Markanter Schneefall"
- schnee/unwetter:   "Unwetterhinweis Schnee"
- schnee/extrem:     "Extremer Schneefall"
- frost/warnung:     "Frost möglich"
- frost/markant:     "Strenger Frost"
- frost/unwetter:    "Sehr strenger Frost"
- glätte/warnung:    "Glättegefahr"
- glätte/markant:    "Gefrierender Niederschlag"
- hitze/warnung:     "Hitze erwartet"
- hitze/markant:     "Markante Hitze"
- hitze/unwetter:    "Extreme Hitze"

BESCHREIBUNG (max. 2 Sätze):
- Zeitfenster
- Konkrete Werte aus dem Input
- 1 kurze Handlungsempfehlung

GEWITTER-BLOCK:
- Übernimm score, level, color EXAKT.
- Begründung in 1-2 Sätzen mit den Metriken (CAPE/LI/LPI/Shear).
- Schätze Konvektionstyp (Einzelzellen / Multizellen / Superzellen / MCS / Frontgewitter).

REGELN:
- Amtliche Warnungen sind höchste Priorität — wenn aktiv, hebe Stufe in der Begründung hervor.
- Erfinde keine Werte, die nicht aus den Daten ableitbar sind.

OUTPUT (NUR JSON):
{
  "gewitter_risiko_6h": {
    "level": "<aus Input>",
    "score": <aus Input EXAKT>,
    "begründung": "1-2 Sätze",
    "zeitfenster": "z.B. '14-19 Uhr'",
    "konvektionstyp": "z.B. 'organisierte Multizellen'",
    "color": "<aus Input>"
  },
  "warnungen_12h": [
    {
      "id": "typ_stufe",
      "typ": "wind|regen|gewitter|hagel|schnee|hitze|glätte|frost",
      "stufe": "warnung|markant|unwetter|extrem",
      "titel": "aus Vorlagen",
      "beschreibung": "1-2 Sätze mit Zahlen + Empfehlung",
      "color": "yellow|orange|red|purple",
      "icon": "Wind|CloudRain|Zap|CloudHail|Snowflake|Thermometer|AlertTriangle"
    }
  ],
  "summary": "1-2 Sätze",
  "disclaimer": "Experimenteller KI-Wetterhinweis. Keine amtliche Warnung. Bei akuter Gefahr DWD/ZAMG/MeteoSwiss/Protezione Civile konsultieren."
}

Farbcodes: warnung=yellow, markant=orange, unwetter=red, extrem=purple

# DATEN FOLGEN`;

async function callAnthropicWithRetry(
  body: unknown,
): Promise<{ ok: true; data: any } | { ok: false; code: ErrorCode; status: number; details: string }> {
  let lastErr: { code: ErrorCode; status: number; details: string } = {
    code: "API_ERROR", status: 500, details: "unknown",
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (resp.ok) return { ok: true, data: await resp.json() };
      const text = await resp.text();
      const status = resp.status;
      const code: ErrorCode = status === 429 ? "RATE_LIMIT" : "API_ERROR";
      lastErr = { code, status, details: text.slice(0, 500) };
      if (!(status === 429 || status >= 500)) return { ok: false, ...lastErr };
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e?.name === "AbortError";
      lastErr = {
        code: isTimeout ? "TIMEOUT" : "API_ERROR",
        status: isTimeout ? 504 : 500,
        details: String(e?.message ?? e),
      };
    }
    if (attempt < 3) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }
  return { ok: false, ...lastErr };
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1).trim());
  }
  return JSON.parse(trimmed);
}

function validateSchema(r: any): string | null {
  if (!r || typeof r !== "object") return "not an object";
  if (!r.gewitter_risiko_6h || typeof r.gewitter_risiko_6h.score !== "number")
    return "gewitter_risiko_6h.score missing";
  if (!Array.isArray(r.warnungen_12h)) return "warnungen_12h not an array";
  if (typeof r.summary !== "string") return "summary missing";
  if (typeof r.disclaimer !== "string") return "disclaimer missing";
  return null;
}

function warningTitle(w: any): string {
  const key = `${w.typ}/${w.stufe}`;
  const titles: Record<string, string> = {
    "gewitter/warnung": "Gewitter möglich",
    "gewitter/markant": "Starkes Gewitter möglich",
    "gewitter/unwetter": "Unwetterhinweis Gewitter",
    "gewitter/extrem": "Extremes Gewitter",
    "hagel/warnung": "Hagel möglich",
    "hagel/markant": "Markanter Hagelschlag",
    "hagel/unwetter": "Unwetterhinweis Hagel",
    "wind/warnung": "Windböen erwartet",
    "wind/markant": "Markante Sturmböen",
    "wind/unwetter": "Sturm",
    "wind/extrem": "Orkan",
    "regen/warnung": "Regen möglich",
    "regen/markant": "Starkregen",
    "regen/unwetter": "Unwetterhinweis Starkregen",
    "regen/extrem": "Extremer Starkregen",
    "schnee/warnung": "Schneefall möglich",
    "schnee/markant": "Markanter Schneefall",
    "schnee/unwetter": "Unwetterhinweis Schnee",
    "schnee/extrem": "Extremer Schneefall",
    "frost/warnung": "Frost möglich",
    "frost/markant": "Strenger Frost",
    "frost/unwetter": "Sehr strenger Frost",
    "glätte/warnung": "Glättegefahr",
    "glätte/markant": "Gefrierender Niederschlag",
    "hitze/warnung": "Hitze erwartet",
    "hitze/markant": "Markante Hitze",
    "hitze/unwetter": "Extreme Hitze",
  };
  return titles[key] ?? "Wetterhinweis";
}

function warningIcon(typ: string): string {
  if (typ === "wind") return "Wind";
  if (typ === "regen") return "CloudRain";
  if (typ === "gewitter") return "Zap";
  if (typ === "hagel") return "CloudHail";
  if (typ === "schnee") return "Snowflake";
  if (typ === "hitze" || typ === "frost") return "Thermometer";
  return "AlertTriangle";
}

function warningDescription(w: any): string {
  if (w.typ === "gewitter")
    return `Gewitter-Score ${w.score ?? 0}/100, CAPE bis ${w.cape_max ?? 0} J/kg. Achte auf Blitzschlag, Starkregen und Böen.`;
  if (w.typ === "hagel")
    return `Konvektive Lage mit Hagel-Signatur (CAPE ${w.cape_max ?? 0} J/kg, Nullgradgrenze ~${w.freezing_level_min ?? 0} m). Fahrzeuge schützen.`;
  if (w.typ === "wind")
    return `Böen bis ${w.max_value ?? 0} km/h. Lose Gegenstände sichern.`;
  if (w.typ === "regen") {
    const nc = w.nowcast_peak && w.nowcast_peak > 0 ? ` (Nowcast-Peak ${w.nowcast_peak} mm/h)` : "";
    return `Bis ${w.max_1h ?? 0} mm/h${nc}, Summe ${w.sum ?? 0} mm. Überflutete Bereiche meiden.`;
  }
  if (w.typ === "schnee")
    return `Bis ${w.sum ?? 0} cm in 12 h möglich. Längere Wegezeiten einplanen.`;
  if (w.typ === "hitze")
    return `Temperaturen bis ${w.max_value ?? 0} °C. Risikogruppen schützen, genug trinken.`;
  if (w.typ === "frost")
    return `Tiefstwerte bis ${w.min_value ?? 0} °C. Frostempfindliche Bereiche schützen.`;
  if (w.typ === "glätte")
    return "Glätte durch gefrierenden Niederschlag oder Nässe bei Frost möglich. Auf Brücken vorsichtig fahren.";
  return "Wetterrisiko möglich. Entwicklung beobachten.";
}

function materializeWarnings(warnings: any[], aiWarnings: any[] = []) {
  const byKey = new Map<string, any>();
  for (const w of aiWarnings) byKey.set(`${w.typ}_${w.stufe}`, w);
  return warnings.map((w, i) => {
    const ai = byKey.get(`${w.typ}_${w.stufe}`);
    return {
      id: ai?.id ?? `${w.typ}_${w.stufe}_${i}`,
      typ: w.typ,
      stufe: w.stufe,
      titel: ai?.titel || warningTitle(w),
      beschreibung: ai?.beschreibung || warningDescription(w),
      color: w.color,
      icon: ai?.icon || warningIcon(w.typ),
      official: w.official === true ? true : undefined,
    };
  });
}

function fallbackResponse(
  warnings: any[],
  serverScore: number,
  level: string,
  color: string,
  convectiveContext: any,
  windowHours: number,
) {
  const cape = convectiveContext?.cape_max_jkg ?? 0;
  const lpi = convectiveContext?.lpi_max_jkg ?? 0;
  const shear = convectiveContext?.wind_shear_max_kmh ?? 0;
  const begründung =
    serverScore > 0
      ? `Composite-Score ${serverScore}/100. CAPE bis ${cape} J/kg${lpi > 0 ? `, LPI ${lpi}` : ""}${shear > 0 ? `, Shear ${shear} km/h` : ""}.`
      : "Konvektive Parameter unter Hinweis-Schwelle.";
  return {
    gewitter_risiko_6h: {
      level,
      score: serverScore,
      begründung,
      zeitfenster: `nächste ${windowHours} h`,
      konvektionstyp:
        serverScore >= 55
          ? "Organisierte Konvektion möglich"
          : serverScore >= 35
            ? "Multizellen möglich"
            : serverScore >= 20
              ? "Einzelzellen möglich"
              : "keine relevante Konvektion",
      color,
    },
    warnungen_12h: materializeWarnings(warnings),
    summary:
      warnings.length > 0
        ? "Lokale Wetterhinweise berechnet. KI-Formulierung vorübergehend nicht verfügbar."
        : "Aktuell keine kritischen Risiken aus lokalen Berechnungen.",
    disclaimer:
      "Experimenteller KI-Wetterhinweis. Keine amtliche Warnung. Bei akuter Gefahr DWD/ZAMG/MeteoSwiss/Protezione Civile konsultieren.",
    _score_version: THUNDERSTORM_SCORE_VERSION,
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return errorResponse(res, 405, "BAD_REQUEST", "Method not allowed");

  const { weatherData, location, windowHours = 12, thunderstormScore } = req.body ?? {};
  const officialWarnings: any[] = req.body?.officialWarnings ?? [];
  const nowcast: any = req.body?.nowcast ?? null;
  if (!weatherData || !location)
    return errorResponse(res, 400, "BAD_REQUEST", "Missing weatherData or location");

  const locLat = typeof location.latitude === "number" ? location.latitude : location.lat;
  const locLon = typeof location.longitude === "number" ? location.longitude : location.lon;
  const dataLat = weatherData?.latitude;
  const dataLon = weatherData?.longitude;
  if (typeof locLat !== "number" || typeof locLon !== "number")
    return errorResponse(res, 400, "BAD_REQUEST", "location missing latitude/longitude");
  if (
    typeof dataLat === "number" &&
    typeof dataLon === "number" &&
    (Math.abs(dataLat - locLat) > 1.0 || Math.abs(dataLon - locLon) > 1.0)
  ) {
    return errorResponse(
      res, 400, "BAD_REQUEST",
      "location and weatherData mismatch",
      `location ${locLat},${locLon} vs data ${dataLat},${dataLon}`,
    );
  }

  // Client-Score (composite) bevorzugt; Server-Fallback ebenfalls composite.
  const clientScore =
    typeof thunderstormScore === "number" && Number.isFinite(thunderstormScore)
      ? Math.max(0, Math.min(100, Math.round(thunderstormScore)))
      : null;
  const serverScore: number = clientScore ?? computeServerStormScore(weatherData, 6);
  const level = scoreLevelLabel(serverScore);
  const color = scoreToColor(serverScore);

  const dLat = typeof dataLat === "number" ? Math.round(dataLat * 10) : "x";
  const dLon = typeof dataLon === "number" ? Math.round(dataLon * 10) : "x";
  const bucket = Math.floor(Date.now() / FRESH_MS);
  const cacheKey = `warnings_v5:${Math.round(locLat * 10)}_${Math.round(locLon * 10)}_${dLat}_${dLon}_s${serverScore}_${bucket}`;
  const locLabel = `${location?.name ?? "?"} (${locLat},${locLon})`;

  const cached = await getCached<any>(cacheKey);
  if (cached && isFresh(cached.timestamp, FRESH_MS)) {
    return res.status(200).json({
      ...cached.data,
      cached: true,
      fromCache: true,
      stale: false,
      cacheAge: ageMinutes(cached.timestamp),
    });
  }

  let warnings = detectWarnings(weatherData, windowHours, nowcast, serverScore);
  warnings = mergeOfficialIntoWarnings(warnings, officialWarnings);
  const convectiveContext = buildConvectiveContext(weatherData, windowHours);

  console.log("[risk-warnings]", JSON.stringify({
    location: location?.name,
    score: serverScore,
    level,
    types: warnings.map((w: any) => `${w.typ}/${w.stufe}${w.official ? "*" : ""}`),
    version: THUNDERSTORM_SCORE_VERSION,
  }));

  const rawHourly = (() => {
    const h = weatherData.hourly;
    if (!h?.time) return null;
    const idx = getIndices(h, windowHours);
    if (idx.length === 0) return null;
    const pick = (arr: any[] | undefined) => (arr ? idx.map((i: number) => arr[i] ?? null) : null);
    return {
      time: idx.map((i: number) => h.time[i]),
      temperature_2m: pick(h.temperature_2m),
      precipitation: pick(h.precipitation),
      wind_gusts_10m: pick(h.wind_gusts_10m),
      cape: pick(h.cape),
      lifted_index: pick(h.lifted_index),
      lightning_potential: pick(h.lightning_potential),
      weather_code: pick(h.weather_code),
    };
  })();

  const dynamicPart =
    `# DATEN\n` +
    `Standort: ${JSON.stringify(location)}\n` +
    `Composite Gewitter-Score (übernehmen): score=${serverScore}, level="${level}", color="${color}"\n` +
    `Konvektive Metriken (${windowHours}h): ${JSON.stringify(convectiveContext)}\n` +
    `Berechnete Hinweise: ${JSON.stringify(warnings)}\n` +
    `Rohdaten ${windowHours}h: ${JSON.stringify(rawHourly)}\n` +
    `Amtliche Warnungen: ${JSON.stringify(officialWarnings)}\n` +
    `Rainbow Nowcast: ${JSON.stringify(nowcast)}`;

  const apiResult = await callAnthropicWithRetry({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: STATIC_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: dynamicPart },
        ],
      },
    ],
  });

  if (!apiResult.ok) {
    const fallback = fallbackResponse(warnings, serverScore, level, color, convectiveContext, windowHours);
    return res.status(200).json({ ...fallback, cached: false, fromCache: false, stale: false, fallback: true });
  }

  const textContent: string = apiResult.data?.content?.[0]?.text ?? "";
  let parsed: any;
  try {
    parsed = extractJson(textContent);
  } catch {
    const fallback = fallbackResponse(warnings, serverScore, level, color, convectiveContext, windowHours);
    return res.status(200).json({ ...fallback, cached: false, fromCache: false, stale: false, fallback: true });
  }
  if (validateSchema(parsed)) {
    const fallback = fallbackResponse(warnings, serverScore, level, color, convectiveContext, windowHours);
    return res.status(200).json({ ...fallback, cached: false, fromCache: false, stale: false, fallback: true });
  }

  parsed.gewitter_risiko_6h.score = serverScore;
  parsed.gewitter_risiko_6h.level = level;
  parsed.gewitter_risiko_6h.color = color;
  parsed.warnungen_12h = materializeWarnings(warnings, parsed.warnungen_12h);
  parsed._score_version = THUNDERSTORM_SCORE_VERSION;

  await setCached(cacheKey, parsed, 24 * 60 * 60);
  return res.status(200).json({ ...parsed, cached: false, fromCache: false, stale: false });
}
