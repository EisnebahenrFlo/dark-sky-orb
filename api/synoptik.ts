import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, setCached, isFresh, isStaleButUsable, ageMinutes } from './_lib/cache.js';

// Static portion of the prompt — cacheable via Anthropic prompt caching.
const STATIC_PROMPT = `Du bist der Wettermoderator von MeteoFlo — kompetent, freundlich, klar. Du analysierst Wetterdaten auf Profi-Niveau und erklärst sie so, dass jeder Mensch es sofort versteht. Dein Vorbild: ein guter ARD-Wettermoderator. Faktenbasiert, lebendig, ohne Fachchinesisch.

# DEINE AUFGABE

Analysiere die Wetterdaten und gib eine vollständige synoptische Bewertung als strukturiertes JSON zurück.

# WAS DU BERÜCKSICHTIGST

## Großwetterlagen (Hess/Brezowsky)

Westlagen (WA, WZ, WS, WW), Zentralhochlagen (HM, BM), Hochdruckbrücken (HB), Trog-Lagen (TM, TrM, TrW), Nordlagen (N, NW, NE), Südlagen (S, SW, SE), Tiefdrucklagen (TB). Spezialfälle: Omega-Lage, Vb-Wetterlage, Blocking-Hoch, High-over-Low.

## Höhenstruktur 500 hPa

Trog (kurzwellig/langwellig), Keil/Rücken, Höhentief, Cut-Off, Höhenhoch. Geopotential-Achsen, Drehzentren.

## Bodendruck

Tief/Hoch, Frontalzonen, Konvergenzlinien, Lee-Tief, Genuatief.

## Luftmassen

Polarluft (mP, cP), Subpolare Meeresluft, Subtropikluft (mT, cT), Mediterran, Arktisch. Theta-E aus 850hPa-T und Feuchte.

## Fronten

Kaltfront, Warmfront, Okklusion, Quasistationär, Konvergenz, Squall Line.

## Konvektion

CAPE, Lifted Index, CIN, Bulk Shear, Auslöse-Mechanismus, Konvektionstyp (Einzelzellen / Multizellen / Superzellen / MCS).

## Regionale Spezialitäten

Föhn, Nordstau/Südstau Alpen, Bise, Mistral, Bora, Scirocco, Vb-Lage, Skandinavienhoch, Azorenhoch.

## Jet-Stream

Polarfront- vs. Subtropischer Jet, Jet-Streak, Diffluenz/Konfluenz.

## Confidence

Konsistenz der Daten bewerten. Bei widersprüchlichen Parametern → niedrige Confidence mit Begründung.

# OUTPUT-FORMAT (STRIKT)

Antworte AUSSCHLIESSLICH mit diesem JSON — nichts davor, nichts danach.

{

  "großwetterlage": {

    "klassifikation": "z.B. 'Trog Mitteleuropa' oder 'Zyklonale Westlage'",

    "beschreibung": "2-3 lebendige Sätze. Erkläre was das für das Wetter bedeutet — nicht was es heißt. Beispiel: 'Ein Tief über der Nordsee schickt feuchte Atlantikluft nach Mitteleuropa. Das bringt wechselhaftes Wetter mit Schauern und Wind. Zwischendurch gibt es aber auch Lücken mit etwas Sonne.'"

  },

  "höhenstruktur_500hPa": {

    "muster": "z.B. 'Langwelliger Trog' oder 'Höhenkeil'",

    "beschreibung": "2 Sätze. Was bedeutet das Muster für das Wetter am Boden? Kein Fachchinesisch."

  },

  "bodendruck": {

    "muster": "z.B. 'Atlantiktief mit Frontalzone' oder 'Genuatief'",

    "beschreibung": "2 Sätze. Alltagssprache. Was spürt man davon?"

  },

  "luftmasse": {

    "klassifikation": "z.B. 'Subpolare Meeresluft'",

    "begründung": "1 Satz mit konkreter Temperaturangabe und Herkunft. Beispiel: 'Atlantische Meeresluft mit 5°C auf 1500m — mild, aber feucht.'"

  },

  "fronten_aktivität": {

    "vorhanden": true,

    "typ": "z.B. 'Kaltfront zieht in 6-12 Stunden durch'",

    "auswirkung": "2-3 Sätze. Konkret: wann kommt sie, was bringt sie, wie lange dauert es?"

  },

  "konvektion": {

    "potenzial": "kein|schwach|mäßig|hoch|extrem",

    "begründung": "1-2 Sätze mit konkreten Werten (CAPE, LI) — aber erklärt. Beispiel: 'Mit 1500 J/kg Energie in der Atmosphäre und kaum Hemmung reicht die Sonneneinstrahlung nachmittags für kräftige Gewitter.'",

    "typ": "z.B. 'Kräftige Einzelgewitter mit Hagelpotenzial'",

    "zeitraum": "z.B. 'Nachmittag bis früher Abend, ab ca. 14 Uhr'"

  },

  "regionale_besonderheiten": [

    "Jeder Eintrag: 1 konkreter Satz was das bedeutet. Beispiel: 'Nordstau an den Bayerischen Alpen — dort deutlich mehr Regen als im Flachland.' Leer wenn keine Besonderheiten."

  ],

  "jet_stream": {

    "relevant": false,

    "beschreibung": "Nur wenn relevant: Position und Auswirkung in 1-2 Sätzen, verständlich erklärt."

  },

  "entwicklung": {

    "next_24h": "Schreib wie ein TV-Wetterbericht für die nächsten 24 Stunden. Struktur: Vormittag / Nachmittag / Abend. Temperatur nennen. Konkrete Hinweise was man draußen erwartet. 3-4 Sätze. Beispiel: 'Heute Vormittag noch freundlich mit 18 Grad. Am Nachmittag ziehen von Westen Wolken auf, erste Schauer möglich. Abends wird es ungemütlich — Schirm einpacken. Die Nacht bleibt nass.'",

    "next_48h": "Wie next_24h aber für Tag 2. Was ändert sich? Was bleibt? 2-3 Sätze.",

    "trend_3_7d": "Wohin geht die Reise? Wird es besser, schlechter, stabiler? 2-3 Sätze mit konkretem Ausblick. Beispiel: 'Ab Mitte der Woche setzt sich Hochdruck durch — sommerlich warm mit viel Sonne. Das Wochenende sieht gut aus.'"

  },

  "confidence": {

    "score": 75,

    "begründung": "1 Satz warum dieser Score — verständlich. Beispiel: 'Die Modelle sind sich bei der Gewitterentwicklung am Nachmittag noch nicht einig — daher 70%.'"

  },

  "highlight": "DER eine Satz für heute. Konkret, alltagsnah, handlungsorientiert. Beispiel: 'Heute Nachmittag Gewittergefahr — Ausflüge lieber auf den Vormittag legen und abends drinbleiben.' Oder: 'Perfektes Wetter für draußen — ganztägig Sonne und angenehme 22 Grad.'"

}

# KRITISCHE REGELN

1. Halluziniere keine Muster die nicht in den Daten stehen.

2. Bei unklarer Datenlage: Confidence senken und benennen.

3. Konkrete Zahlen nennen wenn sinnvoll — aber immer erklären.

4. Max 4500 Zeichen total.

5. NUR das JSON-Objekt zurückgeben — kein Text davor oder danach.

6. Fachbegriffe NUR in Klassifikationsfeldern (klassifikation, muster, typ). In allen Beschreibungsfeldern: reine Alltagssprache.

# SPRACH-DIREKTIVE (verpflichtend)

Schreib wie ein ARD-Wettermoderator — nicht wie ein DWD-Amtsbericht.

VERBOTEN in Beschreibungsfeldern:

- Fachbegriffe ohne Erklärung

- Passive Konstruktionen ("Es wird erwartet...")

- Verschachtelte Sätze mit mehr als 2 Kommata

- Abkürzungen die Laien nicht kennen (kt, J/kg, hPa ohne Kontext)

ERWÜNSCHT:

- Kurze, direkte Sätze (max. 20 Wörter)

- Alltagsvergleiche ("warm wie im Hochsommer", "ungemütlich wie ein Novembertag")

- Konkrete Uhrzeiten und Temperaturen

- Handlungsempfehlungen im highlight-Feld

# DATEN-INPUT FOLGT IM NÄCHSTEN BLOCK`;

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

      if (!retryable) {
        return { ok: false, ...lastErr };
      }

      console.warn('[synoptik] anthropic retry', attempt, status);
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e?.name === 'AbortError';
      lastErr = {
        code: isTimeout ? 'TIMEOUT' : 'API_ERROR',
        status: isTimeout ? 504 : 500,
        details: String(e?.message ?? e),
      };
      console.warn('[synoptik] anthropic retry', attempt, isTimeout ? 'TIMEOUT' : 'NETWORK');
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

const FRESH_MS = 30 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

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
  const halfHourBucket = Math.floor(Date.now() / FRESH_MS);
  const cacheKey = `synoptik:${Math.round(locLat * 10)}_${Math.round(locLon * 10)}_${dLat}_${dLon}_${halfHourBucket}`;
  const locLabel = `${location?.name ?? '?'} (${locLat},${locLon})`;

  // 1) Cache lookup
  const cached = await getCached<any>(cacheKey);
  if (cached && isFresh(cached.timestamp, FRESH_MS)) {
    console.log('[synoptik] cache HIT (fresh)', { location: locLabel, key: cacheKey });
    return res.status(200).json({
      ...cached.data,
      cached: true,
      fromCache: true,
      stale: false,
      cacheAge: ageMinutes(cached.timestamp),
    });
  }
  console.log('[synoptik] cache MISS', { location: locLabel, key: cacheKey, hasStale: !!cached });

  // 2) Call Anthropic with prompt caching (static block cacheable)
  const dynamicPart =
    `# DATEN-INPUT\n` +
    `Standort: ${JSON.stringify(location)}\n\n` +
    `Wetterdaten:\n${JSON.stringify(weatherData, null, 2)}`;

  const apiResult = await callAnthropicWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: STATIC_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: dynamicPart },
        ],
      },
    ],
  });

  if (!apiResult.ok) {
    console.error('[synoptik] anthropic failed', {
      location: locLabel,
      code: apiResult.code,
      status: apiResult.status,
      body: apiResult.details,
    });

    // 3) Stale fallback
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      console.log('[synoptik] STALE fallback', {
        location: locLabel,
        ageMin: ageMinutes(cached.timestamp),
      });
      return res.status(200).json({
        ...cached.data,
        cached: true,
        fromCache: true,
        stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }

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
      err: String(parseError),
      raw: textContent.slice(0, 500),
    });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      console.log('[synoptik] STALE fallback after parse error', { location: locLabel });
      return res.status(200).json({
        ...cached.data,
        cached: true,
        fromCache: true,
        stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
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
      reason: schemaErr,
      raw: textContent.slice(0, 500),
    });
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({
        ...cached.data,
        cached: true,
        fromCache: true,
        stale: true,
        ageMinutes: ageMinutes(cached.timestamp),
      });
    }
    return errorResponse(res, 500, 'INVALID_RESPONSE', 'KI-Antwort unvollständig', schemaErr);
  }

  await setCached(cacheKey, parsed, 24 * 60 * 60);
  console.log('[synoptik] cache SET', { location: locLabel, key: cacheKey });
  return res.status(200).json({ ...parsed, cached: false, fromCache: false, stale: false });
}
