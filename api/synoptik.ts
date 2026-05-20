import type { VercelRequest, VercelResponse } from '@vercel/node';

// In-Memory Cache: 30 Min pro Region
const CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const MASTER_PROMPT = `Du bist erfahrener Synoptiker und Wetter-Analyst mit Schwerpunkt Mitteleuropa (DACH-Region), Alpenraum und Italien. Du analysierst auf Profi-Niveau – vergleichbar mit DWD-Wetterberatungen, ZAMG oder MeteoSwiss.

# DEINE AUFGABE
Analysiere die folgenden Wetterdaten und gib eine vollständige synoptische Bewertung als strukturiertes JSON zurück.

# WAS DU BERÜCKSICHTIGST

## Großwetterlagen (Hess/Brezowsky)
Westlagen (WA, WZ, WS, WW), Zentralhochlagen (HM, BM), Hochdruckbrücken (HB), Trog-Lagen (TM, TrM, TrW), Nordlagen (N, NW, NE), Südlagen (S, SW, SE), Tiefdrucklagen (TB). Spezialfälle: Omega-Lage, Vb-Wetterlage, Blocking-Hoch, High-over-Low.

## Höhenstruktur 500 hPa
Trog (kurzwellig/langwellig), Keil/Rücken, Höhentief, Cut-Off, Höhenhoch. Geopotential-Achsen, Drehzentren, Spread.

## Bodendruck
Tief/Hoch, Frontalzonen, Konvergenzlinien, Lee-Tief, Genuatief.

## Luftmassen
Polarluft (mP, cP), Subpolare Meeresluft, Subtropikluft (mT, cT), Mediterran, Arktisch. Theta-E-Bewertung aus 850hPa-T und Feuchte.

## Fronten
Kaltfront (anabatisch/katabatisch), Warmfront, Okklusion (Kalt/Warm/Neutral), Quasistationär, Konvergenz, Squall Line, Outflow.

## Konvektion (Profi-Niveau)
CAPE-Stärke und Verteilung, Lifted Index, CIN, Bulk Shear (ableiten aus Wind 10m vs. 500hPa), Auslöse-Mechanismus (Front/Konvergenz/Orographie/Diabatik), Konvektionstyp (Einzelzellen / Multizellen / Superzellen / MCS / DMC).

## Regionale Spezialitäten
Föhn (Süd/Nord/Maloja), Nordstau Alpen, Südstau, Bise (CH), Mistral, Bora, Scirocco, Tramontana, Vb-Lage (Mittelmeertief mit Wirkung auf Mitteleuropa), Skandinavienhoch, Azorenhoch-Ausläufer, Russlandhoch.

## Jet-Stream
Polarfront- vs. Subtropischer Jet, Jet-Streak (linke/rechte Ausgangsregion), Coupling, Diffluenz/Konfluenz, sekundäre Zyklogenese.

## Confidence
Konsistenz der Daten bewerten. Bei Modell-Spread oder widersprüchlichen Parametern → niedrige Confidence, mit Begründung.

# DATEN-INPUT
Standort: {{LOCATION}}
Wetterdaten: {{WEATHER_DATA}}

# OUTPUT-FORMAT (STRIKT)
Antworte AUSSCHLIESSLICH mit diesem JSON-Objekt – nichts davor, nichts danach. Sprache: Deutsch, präzise Fachterminologie.

{
  "großwetterlage": {
    "klassifikation": "z.B. 'Trog Mitteleuropa (TrM)' oder 'Westlage zyklonal (WZ)'",
    "beschreibung": "2-3 Sätze synoptische Einordnung"
  },
  "höhenstruktur_500hPa": {
    "muster": "z.B. 'Langwelliger Trog' / 'Höhenkeil'",
    "beschreibung": "1-2 Sätze: Geopotential, Achse, Drehzentren"
  },
  "bodendruck": {
    "muster": "z.B. 'Atlantik-Tief mit Frontalzone' / 'Genuatief'",
    "beschreibung": "1-2 Sätze"
  },
  "luftmasse": {
    "klassifikation": "z.B. 'Subpolare Meeresluft (mP)'",
    "begründung": "1 Satz mit 850hPa-T und Herkunft"
  },
  "fronten_aktivität": {
    "vorhanden": true,
    "typ": "z.B. 'Kaltfront-Passage in 6-12h'",
    "auswirkung": "1-2 Sätze"
  },
  "konvektion": {
    "potenzial": "kein|schwach|mäßig|hoch|extrem",
    "begründung": "CAPE/LI/Shear in 1-2 Sätzen",
    "typ": "z.B. 'organisierte Multizellen mit Hagel-Potenzial'",
    "zeitraum": "z.B. 'Nachmittag/Abend'"
  },
  "regionale_besonderheiten": [
    "Liste relevanter Lagen, z.B. 'Nordstau bayr. Alpen', 'Föhn-Durchbruch', 'Vb-Zugbahn'. Leer wenn keine."
  ],
  "jet_stream": {
    "relevant": false,
    "beschreibung": "wenn relevant: Position und Auswirkung, sonst leer"
  },
  "entwicklung": {
    "next_24h": "1-2 Sätze konkret",
    "next_48h": "1-2 Sätze",
    "trend_3_7d": "1-2 Sätze gröber"
  },
  "confidence": {
    "score": 75,
    "begründung": "1 Satz: warum dieser Score"
  },
  "highlight": "Der EINE wichtigste Punkt für heute, prägnant in 1 Satz"
}

# KRITISCHE REGELN
1. Halluziniere keine Muster, die nicht in den Daten stehen.
2. Bei unklarer Datenlage: Confidence senken und es benennen.
3. Beziehe dich auf konkrete Zahlen wenn sinnvoll (z.B. "CAPE 1800 J/kg").
4. Max 3000 Zeichen total – präzise, nicht ausschweifend.
5. NUR das JSON-Objekt zurückgeben.
6. Korrekte deutsche Fachterminologie.`;

type ErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_RESPONSE'
  | 'BAD_REQUEST';

function errorResponse(
  res: VercelResponse,
  status: number,
  code: ErrorCode,
  error: string,
  details?: string,
) {
  return res.status(status).json({ error, code, ...(details ? { details } : {}) });
}

const RETRY_DELAYS_MS = [500, 1500, 4500];
const REQUEST_TIMEOUT_MS = 30_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callAnthropicWithRetry(body: unknown): Promise<
  | { ok: true; data: any }
  | { ok: false; code: ErrorCode; status: number; details: string }
> {
  let lastErr: { code: ErrorCode; status: number; details: string } = {
    code: 'API_ERROR',
    status: 500,
    details: 'unknown',
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

      // Non-retryable client errors (400/401/403): bail immediately
      if (!retryable) {
        return { ok: false, ...lastErr };
      }

      console.warn('Anthropic API retry', attempt, status);
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e?.name === 'AbortError';
      lastErr = {
        code: isTimeout ? 'TIMEOUT' : 'API_ERROR',
        status: isTimeout ? 504 : 500,
        details: String(e?.message ?? e),
      };
      console.warn('Anthropic API retry', attempt, isTimeout ? 'TIMEOUT' : 'NETWORK');
    }

    if (attempt < 3) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
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
  if (!r.großwetterlage?.klassifikation || !r.großwetterlage?.beschreibung)
    return 'großwetterlage incomplete';
  if (!r.konvektion?.potenzial) return 'konvektion.potenzial missing';
  if (!r.entwicklung?.next_24h) return 'entwicklung.next_24h missing';
  if (typeof r.confidence?.score !== 'number') return 'confidence.score not a number';
  if (typeof r.highlight !== 'string' || !r.highlight.trim()) return 'highlight empty';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return errorResponse(res, 405, 'BAD_REQUEST', 'Method not allowed');

  const { weatherData, location } = req.body ?? {};

  if (!weatherData || !location) {
    return errorResponse(res, 400, 'BAD_REQUEST', 'Missing weatherData or location');
  }

  const locLat = typeof location.latitude === 'number' ? location.latitude : location.lat;
  const locLon = typeof location.longitude === 'number' ? location.longitude : location.lon;
  const dataLat = weatherData?.latitude;
  const dataLon = weatherData?.longitude;

  if (typeof locLat !== 'number' || typeof locLon !== 'number') {
    return errorResponse(res, 400, 'BAD_REQUEST', 'location missing latitude/longitude');
  }
  if (typeof dataLat === 'number' && typeof dataLon === 'number') {
    if (Math.abs(dataLat - locLat) > 1.0 || Math.abs(dataLon - locLon) > 1.0) {
      return errorResponse(
        res,
        400,
        'BAD_REQUEST',
        'location and weatherData mismatch',
        `location ${locLat},${locLon} vs data ${dataLat},${dataLon}`,
      );
    }
  }

  const dLat = typeof dataLat === 'number' ? Math.round(dataLat * 10) : 'x';
  const dLon = typeof dataLon === 'number' ? Math.round(dataLon * 10) : 'x';
  const cacheKey = `${Math.round(locLat * 10)}_${Math.round(locLon * 10)}_${dLat}_${dLon}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;

  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({
      ...cached.data,
      cached: true,
      cacheAge: Math.round((Date.now() - cached.timestamp) / 60000),
    });
  }

  const locLabel = `${location?.name ?? '?'} (${locLat},${locLon})`;

  const prompt = MASTER_PROMPT.replace('{{LOCATION}}', JSON.stringify(location)).replace(
    '{{WEATHER_DATA}}',
    JSON.stringify(weatherData, null, 2),
  );

  const apiResult = await callAnthropicWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!apiResult.ok) {
    console.error('[synoptik] anthropic failed', {
      location: locLabel,
      code: apiResult.code,
      status: apiResult.status,
      body: apiResult.details,
    });
    const userMsg =
      apiResult.code === 'TIMEOUT'
        ? 'KI-Analyse Zeitüberschreitung'
        : apiResult.code === 'RATE_LIMIT'
          ? 'KI-Analyse derzeit überlastet'
          : 'KI-Analyse fehlgeschlagen';
    return errorResponse(res, apiResult.status, apiResult.code, userMsg, apiResult.details);
  }

  const textContent: string = apiResult.data?.content?.[0]?.text ?? '';

  let parsed: any;
  try {
    parsed = extractJson(textContent);
  } catch (parseError) {
    console.error('[synoptik] parse error', {
      location: locLabel,
      code: 'PARSE_ERROR',
      err: String(parseError),
      raw: textContent.slice(0, 500),
    });
    return errorResponse(
      res,
      500,
      'PARSE_ERROR',
      'KI-Antwort konnte nicht geparst werden',
      textContent.slice(0, 500),
    );
  }

  const schemaErr = validateSchema(parsed);
  if (schemaErr) {
    console.error('[synoptik] invalid response', {
      location: locLabel,
      code: 'INVALID_RESPONSE',
      reason: schemaErr,
      raw: textContent.slice(0, 500),
    });
    return errorResponse(
      res,
      500,
      'INVALID_RESPONSE',
      'KI-Antwort unvollständig',
      schemaErr,
    );
  }

  CACHE.set(cacheKey, { data: parsed, timestamp: Date.now() });
  return res.status(200).json({ ...parsed, cached: false });
}
