// Vercel Serverless Function – Gewitter-Risiko + KI-Warnungen
import { getCached, setCached, isFresh, isStaleButUsable, ageMinutes } from './_lib/cache';

const THRESHOLDS = {
  wind_gust_markant: 70, wind_gust_severe: 90, wind_gust_extreme: 118,
  precip_1h_markant: 15, precip_1h_severe: 25, precip_1h_extreme: 40,
  precip_12h_markant: 25, precip_12h_severe: 40, precip_12h_extreme: 70,
  cape_markant: 500, cape_severe: 1500, cape_extreme: 2500,
  li_markant: -2, li_severe: -5, li_extreme: -8,
  snow_12h_markant: 10, snow_12h_severe: 20,
  temp_hot_markant: 32, temp_hot_severe: 38,
  glaze_temp: 2,
};

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

function detectWarnings(weatherData: any) {
  const warnings: any[] = [];
  const hourly = weatherData.hourly;
  if (!hourly?.time) return warnings;
  const idx = getIndices(hourly, 12);
  if (idx.length === 0) return warnings;

  const getMax = (arr: number[], key: 'max' | 'min' = 'max') =>
    idx.reduce((acc: number, i: number) => {
      const v = arr?.[i] ?? (key === 'max' ? -Infinity : Infinity);
      return key === 'max' ? Math.max(acc, v) : Math.min(acc, v);
    }, key === 'max' ? -Infinity : Infinity);

  const maxGust = getMax(hourly.wind_gusts_10m);
  if (maxGust >= THRESHOLDS.wind_gust_markant) {
    const stufe = maxGust >= THRESHOLDS.wind_gust_extreme ? 'extrem'
                : maxGust >= THRESHOLDS.wind_gust_severe ? 'unwetter' : 'markant';
    warnings.push({ typ: 'wind', stufe, max_value: Math.round(maxGust), unit: 'km/h' });
  }

  const max1h = getMax(hourly.precipitation);
  const sum12h = idx.reduce((s: number, i: number) => s + (hourly.precipitation?.[i] ?? 0), 0);
  if (max1h >= THRESHOLDS.precip_1h_markant || sum12h >= THRESHOLDS.precip_12h_markant) {
    const stufe = (max1h >= THRESHOLDS.precip_1h_extreme || sum12h >= THRESHOLDS.precip_12h_extreme) ? 'extrem'
                : (max1h >= THRESHOLDS.precip_1h_severe || sum12h >= THRESHOLDS.precip_12h_severe) ? 'unwetter' : 'markant';
    warnings.push({ typ: 'regen', stufe, max_1h: Math.round(max1h * 10) / 10, sum_12h: Math.round(sum12h * 10) / 10, unit: 'mm' });
  }

  const maxCape = getMax(hourly.cape);
  const minLI = getMax(hourly.lifted_index, 'min');
  if (maxCape >= THRESHOLDS.cape_markant && minLI <= THRESHOLDS.li_markant) {
    const stufe = (maxCape >= THRESHOLDS.cape_extreme && minLI <= THRESHOLDS.li_extreme) ? 'extrem'
                : (maxCape >= THRESHOLDS.cape_severe && minLI <= THRESHOLDS.li_severe) ? 'unwetter' : 'markant';
    warnings.push({ typ: 'gewitter', stufe, cape: Math.round(maxCape), lifted_index: Math.round(minLI * 10) / 10 });
  }

  const snow12h = idx.reduce((s: number, i: number) => s + (hourly.snowfall?.[i] ?? 0), 0);
  if (snow12h >= THRESHOLDS.snow_12h_markant) {
    const stufe = snow12h >= THRESHOLDS.snow_12h_severe ? 'unwetter' : 'markant';
    warnings.push({ typ: 'schnee', stufe, sum_12h: Math.round(snow12h * 10) / 10, unit: 'cm' });
  }

  const maxTemp = getMax(hourly.temperature_2m);
  if (maxTemp >= THRESHOLDS.temp_hot_markant) {
    const stufe = maxTemp >= THRESHOLDS.temp_hot_severe ? 'unwetter' : 'markant';
    warnings.push({ typ: 'hitze', stufe, max_value: Math.round(maxTemp * 10) / 10, unit: '°C' });
  }

  const glazeRisk = idx.some((i: number) =>
    (hourly.temperature_2m?.[i] ?? 999) <= THRESHOLDS.glaze_temp &&
    (hourly.precipitation?.[i] ?? 0) > 0.1
  );
  if (glazeRisk) warnings.push({ typ: 'glätte', stufe: 'markant' });

  return warnings;
}

function computeStormRisk(weatherData: any) {
  const hourly = weatherData.hourly;
  if (!hourly?.time) return { level: 'kein', score: 0, metrics: {} };
  const idx = getIndices(hourly, 6);
  if (idx.length === 0) return { level: 'kein', score: 0, metrics: {} };

  let maxCape = 0, minLI = 999, maxGust = 0, maxShear = 0, maxLight = 0;
  for (const i of idx) {
    maxCape = Math.max(maxCape, hourly.cape?.[i] ?? 0);
    minLI = Math.min(minLI, hourly.lifted_index?.[i] ?? 999);
    maxGust = Math.max(maxGust, hourly.wind_gusts_10m?.[i] ?? 0);
    const w10 = hourly.wind_speed_10m?.[i] ?? 0;
    const w500 = hourly.wind_speed_500hPa?.[i] ?? w10;
    maxShear = Math.max(maxShear, Math.abs(w500 - w10));
    maxLight = Math.max(maxLight, hourly.lightning_potential?.[i] ?? 0);
  }

  let score = 0;
  if (maxCape >= 500) score += Math.min(40, (maxCape - 500) / 75);
  if (minLI <= 0) score += Math.min(25, Math.abs(minLI) * 4);
  if (maxShear >= 10) score += Math.min(20, maxShear - 10);
  if (maxLight >= 1) score += Math.min(15, maxLight * 2);
  score = Math.min(100, Math.round(score));

  const level = score >= 80 ? 'extrem' : score >= 65 ? 'sehr_hoch'
             : score >= 45 ? 'hoch' : score >= 25 ? 'mäßig'
             : score >= 10 ? 'schwach' : 'kein';

  return {
    level, score,
    metrics: {
      cape_max: Math.round(maxCape),
      lifted_index_min: Math.round(minLI * 10) / 10,
      gust_max: Math.round(maxGust),
      shear_max: Math.round(maxShear),
      lightning_max: Math.round(maxLight * 10) / 10,
    }
  };
}

const STATIC_PROMPT = `Du bist Wetter-Sicherheits-Kommunikator für DACH und Italien. Du bekommst BERECHNETE Warnungen (aus harten Schwellenwerten) und ein berechnetes Gewitter-Risiko.

DEINE AUFGABE: Formuliere für jede Warnung einen prägnanten Titel + verständliche Beschreibung. Bewerte das Gewitter-Risiko mit Begründung und Konvektionstyp.

KRITISCH:
- Erfinde KEINE Warnungen. Nutze nur die übergebenen.
- Beschreibung max. 2 Sätze, aktiv formuliert.
- Konkrete Zahlen einbauen (z.B. "Böen bis 85 km/h").
- Bei Gewitter: Konvektionstyp einschätzen (Einzelzellen / Multizellen / Superzellen / MCS).
- Bei Glätte: Hinweis auf Brücken/exponierte Stellen.
- Bei Hitze: Risikogruppen erwähnen (Ältere, Kinder, Herz-Kreislauf).
- Bei Wind: Empfehlung (lose Gegenstände sichern, Wald meiden).

OUTPUT (NUR JSON, nichts davor/danach):
{
  "gewitter_risiko_6h": {
    "level": "<übernehme aus Input>",
    "score": <übernehme>,
    "begründung": "1-2 Sätze, mit konkreten Zahlen",
    "zeitfenster": "z.B. '14-19 Uhr' oder 'durchgehend'",
    "konvektionstyp": "z.B. 'organisierte Multizellen mit Hagel-Potenzial'",
    "color": "green|yellow|orange|red|purple"
  },
  "warnungen_12h": [
    {
      "id": "typ_stufe",
      "typ": "<übernehme>",
      "stufe": "<übernehme>",
      "titel": "Prägnant, max 5 Wörter",
      "beschreibung": "1-2 Sätze mit Zahlen und Empfehlung",
      "color": "yellow|orange|red|purple",
      "icon": "Wind|CloudRain|Zap|Snowflake|Thermometer|AlertTriangle"
    }
  ],
  "summary": "1-2 Sätze Gesamtbewertung",
  "disclaimer": "Experimentelle KI-Auswertung. Keine amtliche Warnung. Bei akuter Gefahr DWD/ZAMG/MeteoSwiss/Protezione Civile konsultieren."
}

Farbcodes:
- gewitter_risiko: kein/schwach=green, mäßig=yellow, hoch=orange, sehr_hoch=red, extrem=purple
- warnungen: markant=yellow/orange, unwetter=red, extrem=purple

# DATEN-INPUT FOLGT IM NÄCHSTEN BLOCK`;

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

  const { weatherData, location } = req.body ?? {};
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

  const dLat = typeof dataLat === 'number' ? Math.round(dataLat * 10) : 'x';
  const dLon = typeof dataLon === 'number' ? Math.round(dataLon * 10) : 'x';
  const bucket = Math.floor(Date.now() / FRESH_MS);
  const cacheKey = `warnings:${Math.round(locLat * 10)}_${Math.round(locLon * 10)}_${dLat}_${dLon}_${bucket}`;
  const locLabel = `${location?.name ?? '?'} (${locLat},${locLon})`;

  // 1) Cache lookup
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

  // 2) Compute warnings + storm risk
  const warnings = detectWarnings(weatherData);
  const stormRisk = computeStormRisk(weatherData);

  // 3) Quiet weather: skip Claude
  if (warnings.length === 0 && stormRisk.score < 10) {
    const result = {
      gewitter_risiko_6h: { ...stormRisk, begründung: 'Stabile Wetterlage, keine konvektiven Auslöser erkennbar.', zeitfenster: '', konvektionstyp: '', color: 'green' },
      warnungen_12h: [],
      summary: 'Keine aktiven Warnungen. Wetterlage ruhig.',
      disclaimer: 'Experimentelle KI-Auswertung. Keine amtliche Warnung.',
    };
    await setCached(cacheKey, result, 24 * 60 * 60);
    return res.status(200).json({ ...result, cached: false, fromCache: false, stale: false });
  }

  // 4) Claude formulates
  const dynamicPart =
    `# DATEN\n` +
    `Standort: ${JSON.stringify(location)}\n` +
    `Berechnete Warnungen: ${JSON.stringify(warnings, null, 2)}\n` +
    `Gewitter-Risiko (berechnet): ${JSON.stringify(stormRisk, null, 2)}`;

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
      location: locLabel, code: apiResult.code, status: apiResult.status, body: apiResult.details,
    });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      console.log('[risk-warnings] STALE fallback', { location: locLabel, ageMin: ageMinutes(cached.timestamp) });
      return res.status(200).json({
        ...cached.data,
        cached: true, fromCache: true, stale: true,
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
    console.error('[risk-warnings] parse error', { location: locLabel, err: String(parseError), raw: textContent.slice(0, 500) });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data, cached: true, fromCache: true, stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    return errorResponse(res, 500, 'PARSE_ERROR', 'KI-Antwort konnte nicht geparst werden', textContent.slice(0, 500));
  }

  const schemaErr = validateSchema(parsed);
  if (schemaErr) {
    console.error('[risk-warnings] invalid response', { location: locLabel, reason: schemaErr });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data, cached: true, fromCache: true, stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    return errorResponse(res, 500, 'INVALID_RESPONSE', 'KI-Antwort unvollständig', schemaErr);
  }

  await setCached(cacheKey, parsed, 24 * 60 * 60);
  console.log('[risk-warnings] cache SET', { location: locLabel });
  return res.status(200).json({ ...parsed, cached: false, fromCache: false, stale: false });
}
