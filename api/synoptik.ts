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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS für Browser-Calls erlauben
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { weatherData, location } = req.body;

  if (!weatherData || !location) {
    return res.status(400).json({ error: 'Missing weatherData or location' });
  }

  // Cache-Key: grobe Region + halbstündliches Zeitfenster
  const cacheKey = `${Math.round(location.lat * 10)}_${Math.round(location.lon * 10)}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;

  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({ ...cached.data, cached: true, cacheAge: Math.round((Date.now() - cached.timestamp) / 60000) });
  }

  try {
    const prompt = MASTER_PROMPT
      .replace('{{LOCATION}}', JSON.stringify(location))
      .replace('{{WEATHER_DATA}}', JSON.stringify(weatherData, null, 2));

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API error:', errorText);
      return res.status(500).json({ error: 'KI-Analyse fehlgeschlagen', details: errorText });
    }

    const data = await anthropicResponse.json();
    const textContent = data.content[0].text;

    // JSON extrahieren (robuster Parser)
    let result;
    try {
      const jsonMatch = textContent.match(/```json\s*([\s\S]*?)\s*```/) || textContent.match(/(\{[\s\S]*\})/);
      result = JSON.parse(jsonMatch ? jsonMatch[1] : textContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Raw:', textContent);
      return res.status(500).json({ error: 'KI-Antwort konnte nicht geparst werden', raw: textContent });
    }

    CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.status(200).json({ ...result, cached: false });

  } catch (error: any) {
    console.error('Synoptik handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
