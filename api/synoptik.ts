import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCached, setCached, isFresh, isStaleButUsable, ageMinutes } from './_lib/cache.js';

const STATIC_PROMPT = `WICHTIG: Antworte AUSSCHLIESSLICH mit dem unten definierten JSON-Schema. Kein anderes Format. Kein altes Schema.
Du bist MeteoFlo's KI-Meteorologe. Dein Vorbild: Özden Terli (ZDF) und Sven Plöger (ARD) — kompetent, direkt, menschlich. Du erklärst Wetter so, dass es jeder sofort versteht und weiß, was er tun soll.

# GOLDENE REGELN (von echten TV-Meteorologen)

1. **Hook zuerst.** Der erste Satz muss den Leser packen. Nicht "Eine Hochdruckbrücke liegt über..." sondern "Heute wird es der schönste Tag der Woche" oder "Achtung: Ab Nachmittag zieht Unwetter auf."

2. **Erklären, nicht dozieren.** Nie Fachbegriff ohne sofortige Alltagsübersetzung. Wenn CAPE = 2000 J/kg, dann: "genug Energie in der Atmosphäre für kräftige Gewitter".

3. **Konkret und zeitlich.** Keine vagen "im Laufe des Tages". Immer: "ab 14 Uhr", "bis zum Abend", "in der Nacht von Dienstag auf Mittwoch".

4. **Handlungsorientiert.** Der Leser soll nach dem Lesen wissen was er tun soll: Regenschirm, Sonnencreme, Fenster zu, Ausflug planen.

5. **Kurze Sätze.** Max. 20 Wörter. Kein Satz mit mehr als 2 Kommata. Hauptsatz schlägt Nebensatz.

6. **Alltagsvergleiche.** "Warm wie Mitte Juli", "ungemütlich wie ein Novembertag", "Luft so schwül wie in einem Dampfbad".

# VERBOTEN
- Passive Konstruktionen ("Es wird erwartet", "Es ist mit zu rechnen")
- Fachbegriffe ohne Erklärung in Beschreibungsfeldern (hPa, J/kg, kt, etc.)
- "Man kann sagen dass...", "Es sei darauf hingewiesen..."
- Verschachtelte Nebensätze
- Mehr als 4500 Zeichen total

# KONVEKTION — KRITISCH
Das konvektion.potenzial-Feld MUSS exakt mit dem übergebenen thunderstorm_level übereinstimmen.
Der thunderstorm_score ist vom Frontend berechnet (physikalische Formel mit LPI, CAPE, CIN, LI) — übernimm ihn exakt, erfinde keinen eigenen Wert.

# OUTPUT — NUR DIESES JSON, NICHTS DAVOR/DANACH

{
  "highlight": "DER eine Satz. Konkret, handlungsorientiert, heute-relevant. Beispiele: 'Gewittergefahr ab 15 Uhr — Ausflüge lieber auf den Vormittag legen.' oder 'Perfekter Sommertag — Sonne satt bis zum Abend, 26 Grad.'",

  "großwetterlage": {
    "klassifikation": "Kurzname z.B. 'Trog Mitteleuropa' oder 'Azorenhoch-Ableger'",
    "beschreibung": "2-3 Sätze. Erster Satz: Was passiert gerade (Hook). Zweiter Satz: Warum. Dritter Satz: Was bedeutet das für heute. Alltagssprache, aktiv."
  },

  "aktuell": {
    "lage": "1-2 Sätze: Was spürt man gerade draußen? Temperatur, Wind, Bewölkung — konkret und lebendig.",
    "luftmasse": "1 Satz: Woher kommt die Luft und was bringt sie mit? Beispiel: 'Atlantische Meeresluft aus dem Westen — mild, aber feucht und wechselhaft.'"
  },

  "konvektion": {
    "potenzial": "<muss exakt thunderstorm_level aus Input sein>",
    "score": <muss exakt thunderstorm_score aus Input sein>,
    "begründung": "1-2 Sätze. Fachbegriffe erlaubt, aber sofort erklärt. Beispiel: 'Mit 1800 J/kg gespeicherter Energie (CAPE) reicht Sonneneinstrahlung nachmittags für kräftige Gewitter.' Bei kein/schwach: kurz erklären warum nicht.",
    "typ": "Nur bei potenzial mäßig/hoch/extrem: Konvektionstyp. Beispiel: 'Organisierte Multizellen mit Hagelpotenzial.' Sonst leer.",
    "zeitraum": "Nur bei potenzial mäßig/hoch/extrem: Wann? Beispiel: 'Ab 14 Uhr, Schwerpunkt 16–20 Uhr.' Sonst leer."
  },

  "entwicklung": {
    "next_24h": "Wetterbericht-Stil: Struktur Vormittag/Nachmittag/Abend. Temperaturen nennen. Konkrete Uhrzeiten. Was zieht durch, was bleibt? 3-4 lebendige Sätze. Handlungsempfehlung am Ende.",
    "next_48h": "Tag 2: Was ändert sich? Was bleibt? 2-3 Sätze. Vergleich zu heute einbauen.",
    "trend_3_7d": "Wohin geht die Reise? Wird es besser, schlechter, stabiler? 2-3 Sätze. Wochenende konkret ansprechen wenn relevant."
  },

  "regionale_besonderheiten": [
    "Nur wenn wirklich vorhanden. Jeder Eintrag: 1 konkreter Alltagssatz. Beispiel: 'In den Alpen deutlich mehr Regen als im Flachland — Wanderungen heute besser meiden.' Leer wenn keine Besonderheiten."
  ],

  "großwetterlage_detail": {
    "höhenstruktur": "1 Satz für Interessierte: Was passiert in 5,5 km Höhe und warum ist das wichtig fürs Wetter unten? Verständlich erklärt.",
    "bodendruck": "1 Satz: Welches Druckgebilde bestimmt das Wetter? Was spürt man davon?",
    "fronten": "1-2 Sätze NUR wenn relevant: Welche Front, wann kommt sie, was bringt sie? Leer wenn keine aktive Front."
  },

  "confidence": {
    "score": <Zahl 0-100>,
    "begründung": "1 kurzer Satz warum dieser Wert. Beispiel: 'Modelle sind sich bei der Gewitterentwicklung noch nicht einig.' oder 'Klare Hochdrucklage — sehr sichere Vorhersage.'"
  }
}`;

type ErrorCode =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'INVALID_RESPONSE'
  | 'BAD_REQUEST';

function errorResponse(res: VercelResponse, status: number, code: ErrorCode, error: string, details?: string) {
  return res.status(status).json({ error, code, ...(details ? { details } : {}) });
}

const RETRY_DELAYS_MS = [500, 1500, 4500];
const REQUEST_TIMEOUT_MS = 30_000;
const FRESH_MS = 30 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function thunderstormLevelLabel(score: number): string {
  if (score >= 86) return 'extrem';
  if (score >= 61) return 'hoch';
  if (score >= 31) return 'mäßig';
  if (score >= 11) return 'schwach';
  return 'kein';
}

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
      if (resp.ok) return { ok: true, data: await resp.json() };
      const text = await resp.text();
      const status = resp.status;
      const code: ErrorCode = status === 429 ? 'RATE_LIMIT' : 'API_ERROR';
      lastErr = { code, status, details: text.slice(0, 500) };
      if (status !== 429 && status < 500) return { ok: false, ...lastErr };
      console.warn('[synoptik] retry', attempt, status);
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e?.name === 'AbortError';
      lastErr = { code: isTimeout ? 'TIMEOUT' : 'API_ERROR', status: isTimeout ? 504 : 500, details: String(e?.message ?? e) };
      console.warn('[synoptik] retry', attempt, isTimeout ? 'TIMEOUT' : 'NETWORK');
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
  if (first !== -1 && last !== -1 && last > first) return JSON.parse(trimmed.slice(first, last + 1).trim());
  return JSON.parse(trimmed);
}

function validateSchema(r: any): string | null {
  if (!r || typeof r !== 'object') return 'not an object';
  if (typeof r.highlight !== 'string' || !r.highlight.trim()) return 'highlight missing';
  if (!r.großwetterlage?.klassifikation) return 'großwetterlage.klassifikation missing';
  if (!r.konvektion?.potenzial) return 'konvektion.potenzial missing';
  if (!r.entwicklung?.next_24h) return 'entwicklung.next_24h missing';
  if (typeof r.confidence?.score !== 'number') return 'confidence.score not a number';
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return errorResponse(res, 405, 'BAD_REQUEST', 'Method not allowed');

  const { weatherData, location, thunderstormScore } = req.body ?? {};
  if (!weatherData || !location) return errorResponse(res, 400, 'BAD_REQUEST', 'Missing weatherData or location');

  const locLat = typeof location.latitude === 'number' ? location.latitude : location.lat;
  const locLon = typeof location.longitude === 'number' ? location.longitude : location.lon;
  const dataLat = weatherData?.latitude;
  const dataLon = weatherData?.longitude;

  if (typeof locLat !== 'number' || typeof locLon !== 'number')
    return errorResponse(res, 400, 'BAD_REQUEST', 'location missing latitude/longitude');
  if (typeof dataLat === 'number' && typeof dataLon === 'number') {
    if (Math.abs(dataLat - locLat) > 1.0 || Math.abs(dataLon - locLon) > 1.0)
      return errorResponse(res, 400, 'BAD_REQUEST', 'location and weatherData mismatch',
        `location ${locLat},${locLon} vs data ${dataLat},${dataLon}`);
  }

  const score: number = typeof thunderstormScore === 'number' ? thunderstormScore : 0;
  const level = thunderstormLevelLabel(score);

  const dLat = typeof dataLat === 'number' ? Math.round(dataLat * 10) : 'x';
  const dLon = typeof dataLon === 'number' ? Math.round(dataLon * 10) : 'x';
  const bucket = Math.floor(Date.now() / FRESH_MS);
  const cacheKey = `synoptik_v2:${Math.round(locLat * 10)}_${Math.round(locLon * 10)}_${dLat}_${dLon}_${bucket}`;
  const locLabel = `${location?.name ?? '?'} (${locLat},${locLon})`;

  const cached = await getCached<any>(cacheKey);
  if (cached && isFresh(cached.timestamp, FRESH_MS)) {
    console.log('[synoptik] cache HIT', { location: locLabel });
    return res.status(200).json({ ...cached.data, cached: true, fromCache: true, stale: false, cacheAge: ageMinutes(cached.timestamp) });
  }

  const dynamicPart =
    `# DATEN-INPUT\n` +
    `Standort: ${JSON.stringify(location)}\n\n` +
    `Gewitter-Score (Frontend, EXAKT übernehmen): thunderstorm_score=${score}, thunderstorm_level="${level}"\n` +
    `→ konvektion.potenzial MUSS "${level}" sein, konvektion.score MUSS ${score} sein.\n\n` +
    `Wetterdaten:\n${JSON.stringify(weatherData, null, 2)}`;

  const apiResult = await callAnthropicWithRetry({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: STATIC_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicPart },
      ],
    }],
  });

  if (!apiResult.ok) {
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS)) {
      return res.status(200).json({ ...cached.data, cached: true, fromCache: true, stale: true, ageMinutes: ageMinutes(cached.timestamp) });
    }
    const userMsg = apiResult.code === 'TIMEOUT' ? 'KI-Analyse Zeitüberschreitung'
      : apiResult.code === 'RATE_LIMIT' ? 'KI-Analyse derzeit überlastet'
      : 'KI-Analyse fehlgeschlagen';
    return errorResponse(res, apiResult.status, apiResult.code, userMsg, apiResult.details);
  }

  const textContent: string = apiResult.data?.content?.[0]?.text ?? '';
  console.log('[synoptik] raw claude response:', textContent.slice(0, 1000));
  let parsed: any;
  try {
    parsed = extractJson(textContent);
  } catch {
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS))
      return res.status(200).json({ ...cached.data, cached: true, fromCache: true, stale: true, ageMinutes: ageMinutes(cached.timestamp) });
    return errorResponse(res, 500, 'PARSE_ERROR', 'KI-Antwort konnte nicht geparst werden', textContent.slice(0, 500));
  }

  const schemaErr = validateSchema(parsed);
  if (schemaErr) {
    if (cached && isStaleButUsable(cached.timestamp, STALE_MAX_MS))
      return res.status(200).json({ ...cached.data, cached: true, fromCache: true, stale: true, ageMinutes: ageMinutes(cached.timestamp) });
    return errorResponse(res, 500, 'INVALID_RESPONSE', 'KI-Antwort unvollständig', schemaErr);
  }

  // Score aus Frontend erzwingen
  parsed.konvektion.score = score;
  parsed.konvektion.potenzial = level;

  await setCached(cacheKey, parsed, 24 * 60 * 60);
  return res.status(200).json({ ...parsed, cached: false, fromCache: false, stale: false });
}
