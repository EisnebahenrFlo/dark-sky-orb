// Vercel Serverless Function – KI-Warnungen
// Gewitter-Score kommt FERTIG BERECHNET vom Frontend (useThunderstormRisk).
// Claude formuliert nur — er rechnet nicht.
import { getCached, setCached, isFresh, isStaleButUsable, ageMinutes } from './_lib/cache.js';

// Stufen-System (Score-basiert, NICHT abhängig von amtlichen Warnungen):
//   20–34  → warnung  (yellow)
//   35–54  → markant  (orange)
//   55–74  → unwetter (red)
//   75–100 → extrem   (purple)
type Stufe = 'warnung' | 'markant' | 'unwetter' | 'extrem';

function stufeColor(stufe: Stufe): 'yellow' | 'orange' | 'red' | 'purple' {
  switch (stufe) {
    case 'warnung': return 'yellow';
    case 'markant': return 'orange';
    case 'unwetter': return 'red';
    case 'extrem': return 'purple';
  }
}

type ErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_RESPONSE'
  | 'BAD_REQUEST';

const FRESH_MS = 15 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAYS_MS = [500, 1500, 4500];
const REQUEST_TIMEOUT_MS = 30_000;

function errorResponse(res: any, status: number, code: ErrorCode, error: string, details?: string) {
  return res.status(status).json({ error, code, ...(details ? { details } : {}) });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function getIndices(hourly: any, hours: number): number[] {
  const now = Date.now();
  return hourly.time
    .map((t: string, i: number) => ({ t: new Date(t).getTime(), i }))
    .filter((item: { t: number; i: number }) => item.t >= now && item.t <= now + hours * 3600 * 1000)
    .map((item: { t: number; i: number }) => item.i);
}

// ---- Server-seitige Score-Berechnung (kopiert aus src/hooks/useThunderstormRisk.ts) ----
function scoreFromCAPE(cape: number | null | undefined): number {
  if (cape == null || Number.isNaN(cape) || cape <= 0) return 0;
  if (cape >= 2500) return 80;
  if (cape >= 1500) return 65;
  if (cape >= 1000) return 50;
  if (cape >= 500) return 35;
  if (cape >= 300) return 20;
  return 0;
}

function computeHourScore(
  capeVal: number | null | undefined,
  lpiVal: number | null | undefined,
  gustVal: number | null | undefined,
): number {
  const basis = scoreFromCAPE(capeVal);
  let bonus = 0;
  const lpi = typeof lpiVal === 'number' && !Number.isNaN(lpiVal) ? lpiVal : 0;
  if (lpi > 5) bonus += 15;
  else if (lpi > 0) bonus += 10;
  const gust = typeof gustVal === 'number' && !Number.isNaN(gustVal) ? gustVal : 0;
  if (gust > 50) bonus += 5;
  return Math.min(100, basis + bonus);
}

// Peak-Score über die nächsten N Stunden ab jetzt
function computeServerStormScore(weatherData: any, hours = 6): number {
  const h = weatherData?.hourly;
  if (!h?.time) return 0;
  const nowMs = Date.now();
  let peak = 0;
  let counted = 0;
  for (let i = 0; i < h.time.length && counted < hours; i++) {
    const t = new Date(h.time[i]).getTime();
    if (t < nowMs) continue;
    const s = computeHourScore(h.cape?.[i], h.lightning_potential?.[i], h.wind_gusts_10m?.[i]);
    if (s > peak) peak = s;
    counted++;
  }
  return peak;
}

function stufeFromScore(score: number): Stufe {
  if (score >= 75) return 'extrem';
  if (score >= 55) return 'unwetter';
  if (score >= 35) return 'markant';
  return 'warnung';
}

function detectWarnings(weatherData: any, windowHours: number, officialWarnings: any[] = [], stormScore = 0) {
  const warnings: any[] = [];
  const hourly = weatherData.hourly;
  if (!hourly?.time) return warnings;
  const idx = getIndices(hourly, windowHours);
  if (idx.length === 0) return warnings;

  const getMax = (arr: number[] | undefined, key: 'max' | 'min' = 'max') =>
    idx.reduce((acc: number, i: number) => {
      const v = arr?.[i] ?? (key === 'max' ? -Infinity : Infinity);
      return key === 'max' ? Math.max(acc, v) : Math.min(acc, v);
    }, key === 'max' ? -Infinity : Infinity);

  // Wind: Böen >=60 warnung, >=75 markant, >=90 unwetter, >=118 extrem
  const maxGust = getMax(hourly.wind_gusts_10m);
  if (maxGust >= 60) {
    const stufe: Stufe = maxGust >= 118 ? 'extrem' : maxGust >= 90 ? 'unwetter' : maxGust >= 75 ? 'markant' : 'warnung';
    warnings.push({ typ: 'wind', stufe, max_value: Math.round(maxGust), unit: 'km/h' });
  }

  // Starkregen: >=10mm/h oder >=15mm/12h warnung, >=25mm/h markant, >=40mm/h unwetter
  const max1h = getMax(hourly.precipitation);
  const sum12 = idx.reduce((s: number, i: number) => s + (hourly.precipitation?.[i] ?? 0), 0);
  if (max1h >= 10 || sum12 >= 15) {
    const stufe: Stufe = max1h >= 40 ? 'unwetter' : max1h >= 25 ? 'markant' : 'warnung';
    warnings.push({ typ: 'regen', stufe, max_1h: Math.round(max1h * 10) / 10, sum: Math.round(sum12 * 10) / 10, unit: 'mm' });
  }

  // Schnee: >=5cm/12h warnung, >=10 markant, >=20 unwetter
  const snow = idx.reduce((s: number, i: number) => s + (hourly.snowfall?.[i] ?? 0), 0);
  if (snow >= 5) {
    const stufe: Stufe = snow >= 20 ? 'unwetter' : snow >= 10 ? 'markant' : 'warnung';
    warnings.push({ typ: 'schnee', stufe, sum: Math.round(snow * 10) / 10, unit: 'cm' });
  }

  // Gewitter: stufe leitet sich aus dem serverseitig berechneten Score ab (>=20).
  // Ausgelöst, wenn Score-Schwelle erreicht ODER amtliche Gewitterwarnung aktiv.
  const maxCape = idx.reduce((m: number, i: number) => Math.max(m, hourly.cape?.[i] ?? 0), 0);
  const hasOfficialThunderstorm = officialWarnings?.some(
    (w: any) => typeof w?.type === 'string' && w.type.toLowerCase().includes('thunderstorm'),
  );
  if (stormScore >= 20 || hasOfficialThunderstorm) {
    const stufe: Stufe = stufeFromScore(stormScore);
    warnings.push({
      typ: 'gewitter',
      stufe,
      score: stormScore,
      cape_max: Math.round(maxCape),
      official: !!hasOfficialThunderstorm,
      unit: 'J/kg',
    });
  }

  // Hitze: >=30°C warnung, >=35 markant, >=38 unwetter
  const maxTemp = getMax(hourly.temperature_2m);
  if (maxTemp >= 30) {
    const stufe: Stufe = maxTemp >= 38 ? 'unwetter' : maxTemp >= 35 ? 'markant' : 'warnung';
    warnings.push({ typ: 'hitze', stufe, max_value: Math.round(maxTemp), unit: '°C' });
  }

  // Frost: <=-5°C warnung, <=-10°C markant
  const minTemp = getMax(hourly.temperature_2m, 'min');
  if (minTemp <= -5) {
    const stufe: Stufe = minTemp <= -10 ? 'markant' : 'warnung';
    warnings.push({ typ: 'frost', stufe, min_value: Math.round(minTemp), unit: '°C' });
  }

  // Glätte: <=0°C mit Niederschlag → warnung
  const glazeRisk = idx.some((i: number) =>
    (hourly.temperature_2m?.[i] ?? 999) <= 0 &&
    (hourly.precipitation?.[i] ?? 0) > 0.1
  );
  if (glazeRisk) warnings.push({ typ: 'glätte', stufe: 'warnung' as Stufe });

  // Color je Warnung anhängen
  return warnings.map((w) => ({ ...w, color: stufeColor(w.stufe) }));
}

// Kontext-Metriken für Claude (nur zur Formulierung, nicht zur Score-Berechnung)
function buildConvectiveContext(weatherData: any, windowHours: number) {
  const hourly = weatherData.hourly;
  if (!hourly?.time) return {};
  const idx = getIndices(hourly, windowHours);
  if (idx.length === 0) return {};

  let maxCape = 0, minLI = 999, minCIN = 0, maxLPI = 0, maxShear = 0;
  for (const i of idx) {
    maxCape  = Math.max(maxCape,  hourly.cape?.[i] ?? 0);
    minLI    = Math.min(minLI,    hourly.lifted_index?.[i] ?? 999);
    minCIN   = Math.min(minCIN,   hourly.convective_inhibition?.[i] ?? 0);
    maxLPI   = Math.max(maxLPI,   hourly.lightning_potential?.[i] ?? 0);
    const w10  = hourly.wind_speed_10m?.[i] ?? 0;
    const w500 = hourly.wind_speed_500hPa?.[i] ?? w10;
    maxShear = Math.max(maxShear, Math.abs(w500 - w10));
  }

  return {
    cape_max_jkg:     Math.round(maxCape),
    lifted_index_min: Math.round(minLI * 10) / 10,
    cin_min_jkg:      Math.round(minCIN),
    lpi_max_jkg:      Math.round(maxLPI * 10) / 10,
    wind_shear_max:   Math.round(maxShear),
  };
}

function scoreLevelLabel(score: number): string {
  if (score >= 86) return 'extrem';
  if (score >= 61) return 'sehr_hoch';
  if (score >= 31) return 'hoch';
  if (score >= 11) return 'mäßig';
  if (score >= 1)  return 'schwach';
  return 'kein';
}

function scoreToColor(score: number): string {
  if (score >= 86) return 'purple';
  if (score >= 61) return 'red';
  if (score >= 31) return 'orange';
  if (score >= 11) return 'yellow';
  return 'green';
}

const STATIC_PROMPT = `Du bist erfahrener Meteorologe und Wetter-Sicherheits-Kommunikator für DACH und Italien.

REGEL 0 (ABSOLUT): NIEMALS "LI=999", "LI nicht verfügbar", "LI-Daten fehlen", "Lifted Index unbekannt" oder ähnliches erwähnen. Wenn LI fehlt oder 999 ist, ignoriere es vollständig — kein Hinweis, keine Erwähnung, keine Entschuldigung.


Du bekommst:
1. ROHE Stundenwerte der nächsten 48h (Temperatur, Niederschlag, Wind, CAPE, LI, LPI, Wettercode) — nur als Kontext für Begründung & Gewitter-Einschätzung
2. Einen FERTIG BERECHNETEN Gewitter-Score (0–100) — du übernimmst diesen exakt
3. Eine FERTIG BERECHNETE Liste von Warnungen aus harten Schwellenwerten — das ist die einzige Quelle für warnungen_12h
4. Konvektive Kontext-Metriken
5. Amtliche Warnungen und Rainbow Nowcast

DEINE AUFGABE FÜR warnungen_12h:
- Du bekommst eine Liste berechneter Warnungen. Deine einzige Aufgabe: Formuliere für jede Warnung einen Titel und eine Beschreibung.
- Erfinde KEINE zusätzlichen Warnungen. Füge nichts hinzu, was nicht in der berechneten Liste steht.
- Wenn warnungen: [] übergeben wird, gibst du warnungen_12h: [] zurück — ohne Ausnahme.
- typ, stufe, color und Messwerte übernimmst du EXAKT aus der berechneten Warnung.

TITEL-VORLAGEN (exakt verwenden):
- gewitter/warnung:  "Gewitter möglich"
- gewitter/markant:  "Starkes Gewitter möglich"
- gewitter/unwetter: "Unwetterwarnung Gewitter"
- gewitter/extrem:   "Extremes Unwetter"
- wind/warnung:      "Windböen erwartet"
- wind/markant:      "Markante Windböen"
- wind/unwetter:     "Sturmwarnung"
- wind/extrem:       "Orkanwarnung"
- regen/warnung:     "Regen möglich"
- regen/markant:     "Starkregen"
- regen/unwetter:    "Unwetterwarnung Starkregen"
- schnee/warnung:    "Schneefall möglich"
- schnee/markant:    "Markanter Schneefall"
- schnee/unwetter:   "Unwetterwarnung Schnee"
- frost/warnung:     "Frost möglich"
- frost/markant:     "Strenger Frost"
- glätte/warnung:    "Glättegefahr"
- hitze/warnung:     "Hitze erwartet"
- hitze/markant:     "Markante Hitze"
- hitze/unwetter:    "Extreme Hitze"

BESCHREIBUNG (max. 2 Sätze):
- Zeitfenster (wann, z.B. "ab 16 Uhr", "nachts")
- Konkrete Werte aus der berechneten Warnung (z.B. "Böen bis 81 km/h", "bis 28 mm in 12 h")
- 1 kurze Handlungsempfehlung (Wind: lose Gegenstände sichern; Hitze: Risikogruppen schützen; Glätte: Brücken und exponierte Stellen)

DEINE AUFGABE FÜR Gewitter-Block:
- Übernimm score, level und color des Gewitter-Risikos EXAKT aus dem Input
- Begründe mit den gegebenen Metriken und Rohdaten
- Schätze Konvektionstyp (Einzelzellen / Multizellen / Superzellen / MCS / Frontgewitter)

REGELN:
- Amtliche Warnungen und Rainbow Nowcast nur als Realitäts-Check für summary und Gewitter-Begründung — NICHT für warnungen_12h.
- Erfinde keine Werte, die nicht aus den Daten ableitbar sind.
- Wenn lifted_index_min null, 999 oder fehlt: KEINE Erwähnung von LI in der Begründung — argumentiere dann nur mit CAPE, LPI, Shear und Rohdaten.

OUTPUT (NUR JSON, nichts davor/danach):
{
  "gewitter_risiko_6h": {
    "level": "<aus Input übernehmen>",
    "score": <aus Input übernehmen — EXAKT>,
    "begründung": "1-2 Sätze mit konkreten Messwerten",
    "zeitfenster": "z.B. '14–19 Uhr' oder 'ganztägig'",
    "konvektionstyp": "z.B. 'organisierte Multizellen mit Hagel-Potenzial'",
    "color": "<aus Input übernehmen>"
  },
  "warnungen_12h": [
    {
      "id": "typ_stufe",
      "typ": "wind|regen|gewitter|schnee|hitze|glätte|frost",
      "stufe": "warnung|markant|unwetter|extrem",
      "titel": "aus Titel-Vorlagen",
      "beschreibung": "1-2 Sätze mit Zahlen und Empfehlung",
      "color": "yellow|orange|red|purple",
      "icon": "Wind|CloudRain|Zap|Snowflake|Thermometer|AlertTriangle"
    }
  ],
  "summary": "1-2 Sätze Gesamtbewertung",
  "disclaimer": "Experimentelle KI-Auswertung. Keine amtliche Warnung. Bei akuter Gefahr DWD/ZAMG/MeteoSwiss/Protezione Civile konsultieren."
}

Farbcodes Warnungen (aus Input übernehmen): warnung=yellow, markant=orange, unwetter=red, extrem=purple

# DATEN FOLGEN IM NÄCHSTEN BLOCK`;

async function callAnthropicWithRetry(body: unknown): Promise<
  | { ok: true; data: any }
  | { ok: false; code: ErrorCode; status: number; details: string }
> {
  let lastErr: { code: ErrorCode; status: number; details: string } = {
    code: 'API_ERROR', status: 500, details: 'unknown',
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const data = await resp.json();
        return { ok: true, data };
      }
      const text = await resp.text();
      const status = resp.status;
      const retryable = status === 429 || status >= 500;
      const code: ErrorCode = status === 429 ? 'RATE_LIMIT' : 'API_ERROR';
      lastErr = { code, status, details: text.slice(0, 500) };
      if (!retryable) return { ok: false, ...lastErr };
      console.warn('[risk-warnings] anthropic retry', attempt, status);
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e?.name === 'AbortError';
      lastErr = {
        code: isTimeout ? 'TIMEOUT' : 'API_ERROR',
        status: isTimeout ? 504 : 500,
        details: String(e?.message ?? e),
      };
      console.warn('[risk-warnings] anthropic retry', attempt, isTimeout ? 'TIMEOUT' : 'NETWORK');
    }
    if (attempt < 3) await sleep(RETRY_DELAYS_MS[attempt - 1]);
  }
  return { ok: false, ...lastErr };
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) return JSON.parse(fenced[1].trim());
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1).trim());
  }
  return JSON.parse(trimmed);
}

function validateSchema(r: any): string | null {
  if (!r || typeof r !== 'object') return 'not an object';
  if (!r.gewitter_risiko_6h || typeof r.gewitter_risiko_6h.score !== 'number') return 'gewitter_risiko_6h.score missing';
  if (!Array.isArray(r.warnungen_12h)) return 'warnungen_12h not an array';
  if (typeof r.summary !== 'string') return 'summary missing';
  if (typeof r.disclaimer !== 'string') return 'disclaimer missing';
  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return errorResponse(res, 405, 'BAD_REQUEST', 'Method not allowed');

  const { weatherData, location, windowHours = 48, thunderstormScore } = req.body ?? {};
  const officialWarnings: any[] = req.body?.officialWarnings ?? [];
  const nowcast: any = req.body?.nowcast ?? null;
  if (!weatherData || !location) return errorResponse(res, 400, 'BAD_REQUEST', 'Missing weatherData or location');

  const locLat = typeof location.latitude === 'number' ? location.latitude : location.lat;
  const locLon = typeof location.longitude === 'number' ? location.longitude : location.lon;
  const dataLat = weatherData?.latitude;
  const dataLon = weatherData?.longitude;

  if (typeof locLat !== 'number' || typeof locLon !== 'number') {
    return errorResponse(res, 400, 'BAD_REQUEST', 'location missing latitude/longitude');
  }
  if (typeof dataLat === 'number' && typeof dataLon === 'number') {
    if (Math.abs(dataLat - locLat) > 1.0 || Math.abs(dataLon - locLon) > 1.0) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'location and weatherData mismatch',
        `location ${locLat},${locLon} vs data ${dataLat},${dataLon}`);
    }
  }

  // Single Source of Truth: lokaler useThunderstormRisk-Score vom Client.
  // Fallback auf serverseitige Berechnung, falls kein Wert übergeben wurde.
  const clientScore = typeof thunderstormScore === 'number' && Number.isFinite(thunderstormScore)
    ? Math.max(0, Math.min(100, Math.round(thunderstormScore)))
    : null;
  const serverScore: number = clientScore ?? computeServerStormScore(weatherData, 6);
  const level = scoreLevelLabel(serverScore);
  const color = scoreToColor(serverScore);

  const dLat = typeof dataLat === 'number' ? Math.round(dataLat * 10) : 'x';
  const dLon = typeof dataLon === 'number' ? Math.round(dataLon * 10) : 'x';
  const bucket = Math.floor(Date.now() / FRESH_MS);
  const cacheKey = `warnings_v3:${Math.round(locLat * 10)}_${Math.round(locLon * 10)}_${dLat}_${dLon}_s${serverScore}_${bucket}`;
  const locLabel = `${location?.name ?? '?'} (${locLat},${locLon})`;

  // Cache lookup
  const cached = await getCached<any>(cacheKey);
  if (cached && isFresh(cached.timestamp, FRESH_MS)) {
    console.log('[risk-warnings] cache HIT (fresh)', { location: locLabel });
    return res.status(200).json({
      ...cached.data,
      cached: true, fromCache: true, stale: false,
      cacheAge: ageMinutes(cached.timestamp),
    });
  }
  console.log('[risk-warnings] cache MISS', { location: locLabel, hasStale: !!cached });

  // Warnungen berechnen
  const warnings = detectWarnings(weatherData, windowHours, officialWarnings, serverScore);
  const convectiveContext = buildConvectiveContext(weatherData, windowHours);

  console.log('[risk-warnings] INPUT', JSON.stringify({
    location: location?.name,
    cape_max: Math.max(...(weatherData.hourly.cape?.slice(0, 12) ?? [0])),
    gust_max: Math.max(...(weatherData.hourly.wind_gusts_10m?.slice(0, 12) ?? [0])),
    storm_score: serverScore,
    storm_level: level,
    warnings_detected: warnings.map((w: any) => `${w.typ}_${w.stufe}_${w.max_value}${w.unit}`),
  }));

  // Rohe Stundenwerte für die nächsten windowHours an Claude weiterreichen
  const rawHourly = (() => {
    const h = weatherData.hourly;
    if (!h?.time) return null;
    const idx = getIndices(h, windowHours);
    if (idx.length === 0) return null;
    const pick = (arr: any[] | undefined) =>
      arr ? idx.map((i: number) => arr[i] ?? null) : null;
    return {
      time: idx.map((i: number) => h.time[i]),
      temperature_2m: pick(h.temperature_2m),
      precipitation: pick(h.precipitation),
      wind_gusts_10m: pick(h.wind_gusts_10m),
      wind_speed_10m: pick(h.wind_speed_10m),
      cape: pick(h.cape),
      lifted_index: pick(h.lifted_index),
      lightning_potential: pick(h.lightning_potential),
      weather_code: pick(h.weather_code),
    };
  })();

  // Claude formuliert
  const dynamicPart =
    `# DATEN\n` +
    `Standort: ${JSON.stringify(location)}\n` +
    `Berechneter Gewitter-Score (serverseitig, exakt übernehmen): score=${serverScore}, level="${level}", color="${color}"\n` +
    `Konvektive Metriken (${windowHours}h-Fenster): ${JSON.stringify(convectiveContext, null, 2)}\n` +
    `Hinweis-Warnungen aus Schwellenwerten (nur Anhaltspunkt): ${JSON.stringify(warnings, null, 2)}\n` +
    `Rohe Stundenwerte nächste ${windowHours}h: ${JSON.stringify(rawHourly)}\n` +
    `Amtliche Warnungen (DWD/MeteoAlarm — höchste Priorität): ${JSON.stringify(officialWarnings, null, 2)}\n` +
    `Rainbow Nowcast (Niederschlag nächste 2h): ${JSON.stringify(nowcast, null, 2)}`;

  const apiResult = await callAnthropicWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: STATIC_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicPart },
      ],
    }],
  });

  if (!apiResult.ok) {
    console.error('[risk-warnings] anthropic failed', {
      location: locLabel, code: apiResult.code, status: apiResult.status,
    });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data, cached: true, fromCache: true, stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    const userMsg =
      apiResult.code === 'TIMEOUT' ? 'KI-Warnungen Zeitüberschreitung'
      : apiResult.code === 'RATE_LIMIT' ? 'KI-Warnungen derzeit überlastet'
      : 'KI-Formulierung fehlgeschlagen';
    return errorResponse(res, apiResult.status, apiResult.code, userMsg, apiResult.details);
  }

  const textContent: string = apiResult.data?.content?.[0]?.text ?? '';
  let parsed: any;
  try {
    parsed = extractJson(textContent);
  } catch (parseError) {
    console.error('[risk-warnings] parse error', { location: locLabel, err: String(parseError) });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data, cached: true, fromCache: true, stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    return errorResponse(res, 500, 'PARSE_ERROR', 'KI-Antwort konnte nicht geparst werden');
  }

  const schemaErr = validateSchema(parsed);
  if (schemaErr) {
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data, cached: true, fromCache: true, stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    return errorResponse(res, 500, 'INVALID_RESPONSE', 'KI-Antwort unvollständig', schemaErr);
  }

  // Server-Score erzwingen (Claude darf ihn nicht verändern)
  parsed.gewitter_risiko_6h.score = serverScore;
  parsed.gewitter_risiko_6h.level = level;
  parsed.gewitter_risiko_6h.color = color;

  await setCached(cacheKey, parsed, 24 * 60 * 60);
  console.log('[risk-warnings] cache SET', { location: locLabel });
  return res.status(200).json({ ...parsed, cached: false, fromCache: false, stale: false });
}
