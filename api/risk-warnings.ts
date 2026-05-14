// Vercel Serverless Function – Gewitter-Risiko + KI-Warnungen
const CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 Min – sensibler als Synoptik

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

function getIndices(hourly: any, hours: number) {
  const now = Date.now();
  return hourly.time
    .map((t: string, i: number) => ({ t: new Date(t).getTime(), i }))
    .filter(({ t }: any) => t >= now && t <= now + hours * 3600 * 1000)
    .map(({ i }: any) => i);
}

function detectWarnings(weatherData: any) {
  const warnings: any[] = [];
  const hourly = weatherData.hourly;
  if (!hourly?.time) return warnings;
  const idx = getIndices(hourly, 12);
  if (idx.length === 0) return warnings;

  const getMax = (arr: number[], key: 'max' | 'min' = 'max') =>
    idx.reduce((acc, i) => {
      const v = arr?.[i] ?? (key === 'max' ? -Infinity : Infinity);
      return key === 'max' ? Math.max(acc, v) : Math.min(acc, v);
    }, key === 'max' ? -Infinity : Infinity);

  // Wind
  const maxGust = getMax(hourly.wind_gusts_10m);
  if (maxGust >= THRESHOLDS.wind_gust_markant) {
    const stufe = maxGust >= THRESHOLDS.wind_gust_extreme ? 'extrem'
                : maxGust >= THRESHOLDS.wind_gust_severe ? 'unwetter' : 'markant';
    warnings.push({ typ: 'wind', stufe, max_value: Math.round(maxGust), unit: 'km/h' });
  }

  // Regen
  const max1h = getMax(hourly.precipitation);
  const sum12h = idx.reduce((s, i) => s + (hourly.precipitation?.[i] ?? 0), 0);
  if (max1h >= THRESHOLDS.precip_1h_markant || sum12h >= THRESHOLDS.precip_12h_markant) {
    const stufe = (max1h >= THRESHOLDS.precip_1h_extreme || sum12h >= THRESHOLDS.precip_12h_extreme) ? 'extrem'
                : (max1h >= THRESHOLDS.precip_1h_severe || sum12h >= THRESHOLDS.precip_12h_severe) ? 'unwetter' : 'markant';
    warnings.push({ typ: 'regen', stufe, max_1h: Math.round(max1h * 10) / 10, sum_12h: Math.round(sum12h * 10) / 10, unit: 'mm' });
  }

  // Gewitter
  const maxCape = getMax(hourly.cape);
  const minLI = getMax(hourly.lifted_index, 'min');
  if (maxCape >= THRESHOLDS.cape_markant && minLI <= THRESHOLDS.li_markant) {
    const stufe = (maxCape >= THRESHOLDS.cape_extreme && minLI <= THRESHOLDS.li_extreme) ? 'extrem'
                : (maxCape >= THRESHOLDS.cape_severe && minLI <= THRESHOLDS.li_severe) ? 'unwetter' : 'markant';
    warnings.push({ typ: 'gewitter', stufe, cape: Math.round(maxCape), lifted_index: Math.round(minLI * 10) / 10 });
  }

  // Schnee
  const snow12h = idx.reduce((s, i) => s + (hourly.snowfall?.[i] ?? 0), 0);
  if (snow12h >= THRESHOLDS.snow_12h_markant) {
    const stufe = snow12h >= THRESHOLDS.snow_12h_severe ? 'unwetter' : 'markant';
    warnings.push({ typ: 'schnee', stufe, sum_12h: Math.round(snow12h * 10) / 10, unit: 'cm' });
  }

  // Hitze
  const maxTemp = getMax(hourly.temperature_2m);
  if (maxTemp >= THRESHOLDS.temp_hot_markant) {
    const stufe = maxTemp >= THRESHOLDS.temp_hot_severe ? 'unwetter' : 'markant';
    warnings.push({ typ: 'hitze', stufe, max_value: Math.round(maxTemp * 10) / 10, unit: '°C' });
  }

  // Glätte
  const glazeRisk = idx.some(i => 
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

const MASTER_PROMPT = `Du bist Wetter-Sicherheits-Kommunikator für DACH und Italien. Du bekommst BERECHNETE Warnungen (aus harten Schwellenwerten) und ein berechnetes Gewitter-Risiko. 

DEINE AUFGABE: Formuliere für jede Warnung einen prägnanten Titel + verständliche Beschreibung. Bewerte das Gewitter-Risiko mit Begründung und Konvektionstyp.

KRITISCH:
- Erfinde KEINE Warnungen. Nutze nur die übergebenen.
- Beschreibung max. 2 Sätze, aktiv formuliert.
- Konkrete Zahlen einbauen (z.B. "Böen bis 85 km/h").
- Bei Gewitter: Konvektionstyp einschätzen (Einzelzellen / Multizellen / Superzellen / MCS).
- Bei Glätte: Hinweis auf Brücken/exponierte Stellen.
- Bei Hitze: Risikogruppen erwähnen (Ältere, Kinder, Herz-Kreislauf).
- Bei Wind: Empfehlung (lose Gegenstände sichern, Wald meiden).

DATEN:
Standort: {{LOCATION}}
Berechnete Warnungen: {{WARNINGS}}
Gewitter-Risiko (berechnet): {{STORM_RISK}}

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
- warnungen: markant=yellow/orange, unwetter=red, extrem=purple`;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { weatherData, location } = req.body;
  if (!weatherData || !location) return res.status(400).json({ error: 'Missing weatherData or location' });

  // Cache-Key: Region + 15-min-Fenster
  const cacheKey = `${Math.round(location.lat * 10)}_${Math.round(location.lon * 10)}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({ ...cached.data, cached: true });
  }

  // 1. Schwellenwerte regelbasiert prüfen
  const warnings = detectWarnings(weatherData);
  const stormRisk = computeStormRisk(weatherData);

  // 2. Wenn alles ruhig: Claude überspringen, direkt zurück
  if (warnings.length === 0 && stormRisk.score < 10) {
    const result = {
      gewitter_risiko_6h: { ...stormRisk, begründung: 'Stabile Wetterlage, keine konvektiven Auslöser erkennbar.', zeitfenster: '', konvektionstyp: '', color: 'green' },
      warnungen_12h: [],
      summary: 'Keine aktiven Warnungen. Wetterlage ruhig.',
      disclaimer: 'Experimentelle KI-Auswertung. Keine amtliche Warnung.',
      cached: false,
    };
    CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.status(200).json(result);
  }

  // 3. Claude formuliert
  try {
    const prompt = MASTER_PROMPT
      .replace('{{LOCATION}}', JSON.stringify(location))
      .replace('{{WARNINGS}}', JSON.stringify(warnings, null, 2))
      .replace('{{STORM_RISK}}', JSON.stringify(stormRisk, null, 2));

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'KI-Formulierung fehlgeschlagen', details: err });
    }

    const data = await r.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
    const result = JSON.parse(jsonMatch ? jsonMatch[1] : text);

    CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.status(200).json({ ...result, cached: false });
  } catch (e: any) {
    console.error('Risk-warnings handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
