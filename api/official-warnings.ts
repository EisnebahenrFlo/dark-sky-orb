const CACHE = new Map<string, { data: any; timestamp: number }>();

const CACHE_TTL_MS = 15 * 60 * 1000;

// DWD Warning-Type-Mapping (Eventcodes → unsere Typen)
const DWD_TYPE_MAP: Record<string, string> = {
  '11': 'wind', '12': 'wind', '13': 'wind', '14': 'wind', '15': 'wind',
  '31': 'thunderstorm', '33': 'thunderstorm', '34': 'thunderstorm', '36': 'thunderstorm',
  '40': 'rain', '41': 'rain', '42': 'rain', '43': 'rain', '44': 'rain',
  '46': 'rain', '49': 'rain',
  '51': 'snow', '52': 'snow', '53': 'snow', '54': 'snow', '55': 'snow', '56': 'snow',
  '57': 'ice', '58': 'ice', '59': 'ice', '60': 'ice',
  '61': 'thaw', '62': 'thaw',
  '63': 'glaze', '64': 'glaze', '65': 'glaze', '66': 'glaze',
  '70': 'snow_drift', '71': 'snow_drift',
  '79': 'extreme',
  '82': 'cold', '84': 'cold', '85': 'cold', '87': 'cold', '88': 'cold', '89': 'cold',
  '90': 'thunderstorm', '91': 'thunderstorm', '92': 'thunderstorm', '93': 'thunderstorm', '95': 'thunderstorm', '96': 'thunderstorm',
  '98': 'fog', '99': 'fog',
  '246': 'uv', '247': 'heat', '248': 'heat',
};

type OfficialWarning = {
  id: string;
  source: string;
  type: string;
  level: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  area: string;
  start: string;
  end: string;
  url?: string;
};

async function fetchDWDWarnings(lat: number, lon: number): Promise<OfficialWarning[]> {
  try {
    const r = await fetch('https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json', {
      headers: { 'User-Agent': 'MeteoFlo/1.0 (non-commercial weather app)' }
    });
    if (!r.ok) throw new Error(`DWD ${r.status}`);

    // Response ist JSONP-style: "warnWetter.loadWarnings({...});"
    const text = await r.text();
    const jsonStart = text.indexOf('({');
    const jsonEnd = text.lastIndexOf('})');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('DWD format');

    const data = JSON.parse(text.substring(jsonStart + 1, jsonEnd + 1));
    const warnings: OfficialWarning[] = [];

    // data.warnings ist ein Object mit warnCellId als key, Array als value
    for (const cellId of Object.keys(data.warnings || {})) {
      for (const w of data.warnings[cellId]) {
        // Distanzfilter: Wir können ohne genaue Warnzellen-Geo nur grob filtern
        // Für saubere Implementation: vorgenerierte WarnCellID→Bounding-Box Tabelle
        // Pragmatisch: Wir akzeptieren alle Warnungen und filtern später im Frontend nach Distanz/Region-Name
        warnings.push({
          id: `dwd_${w.regionName}_${w.start}_${w.event}`,
          source: 'DWD',
          type: DWD_TYPE_MAP[String(w.eventCode)] || 'other',
          level: Math.min(4, Math.max(1, Number(w.level))) as 1|2|3|4,
          title: w.headline || w.event,
          description: w.description || '',
          area: w.regionName || 'Unbekannte Region',
          start: new Date(w.start).toISOString(),
          end: new Date(w.end).toISOString(),
          url: 'https://www.dwd.de/DE/wetter/warnungen/warnungen_node.html',
        });
      }
    }
    return warnings;
  } catch (e) {
    console.error('[DWD]', e);
    return [];
  }
}

async function fetchMeteoAlarm(country: string): Promise<OfficialWarning[]> {
  const countryMap: Record<string, string> = {
    AT: 'austria',
    CH: 'switzerland',
    IT: 'italy',
    DE: 'germany',
  };
  const slug = countryMap[country];
  if (!slug) return [];

  try {
    const r = await fetch(`https://feeds.meteoalarm.org/api/v1/warnings/feeds-${slug}`, {
      headers: { 'User-Agent': 'MeteoFlo/1.0', 'Accept': 'application/json' }
    });
    if (!r.ok) throw new Error(`MeteoAlarm ${r.status}`);
    const data = await r.json();

    const warnings: OfficialWarning[] = [];
    for (const warn of data.warnings || []) {
      const props = warn.properties || {};
      const level = Math.min(4, Math.max(1, Number(props.awareness_level?.[0]) || 2)) as 1|2|3|4;
      warnings.push({
        id: `meteoalarm_${slug}_${warn.id}`,
        source: `MeteoAlarm-${country}`,
        type: mapMeteoAlarmType(props.awareness_type?.[0]),
        level,
        title: props.event || 'Wetterwarnung',
        description: props.description || props.instruction || '',
        area: props.areaDesc || 'Region',
        start: props.onset || new Date().toISOString(),
        end: props.expires || new Date(Date.now() + 12*3600*1000).toISOString(),
        url: 'https://www.meteoalarm.org',
      });
    }
    return warnings;
  } catch (e) {
    console.error('[MeteoAlarm]', e);
    return [];
  }
}

function mapMeteoAlarmType(awarenessType: string): string {
  const map: Record<string, string> = {
    '1': 'wind', '2': 'snow', '3': 'thunderstorm', '4': 'fog',
    '5': 'cold', '6': 'heat', '7': 'glaze', '8': 'rain',
    '9': 'flood', '10': 'avalanche', '11': 'rain',
  };
  return map[String(awarenessType)] || 'other';
}

function inferCountry(lat: number, lon: number): string {
  // Grobe geografische Zuordnung
  if (lat >= 47.27 && lat <= 55.06 && lon >= 5.87 && lon <= 15.04) return 'DE';
  if (lat >= 46.37 && lat <= 49.02 && lon >= 9.53 && lon <= 17.16) return 'AT';
  if (lat >= 45.82 && lat <= 47.81 && lon >= 5.96 && lon <= 10.49) return 'CH';
  if (lat >= 35.49 && lat <= 47.09 && lon >= 6.62 && lon <= 18.51) return 'IT';
  return 'OTHER';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon, country: explicitCountry } = req.body;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return res.status(400).json({ error: 'lat/lon required' });
  }

  const country = explicitCountry || inferCountry(lat, lon);

  const cacheKey = `${Math.round(lat * 10)}_${Math.round(lon * 10)}_${country}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json({ ...cached.data, cached: true });
  }

  try {
    let warnings: OfficialWarning[] = [];
    const sources: string[] = [];

    if (country === 'DE') {
      const dwd = await fetchDWDWarnings(lat, lon);
      warnings = warnings.concat(dwd);
      if (dwd.length > 0) sources.push('DWD');
    } else if (['AT', 'CH', 'IT'].includes(country)) {
      const ma = await fetchMeteoAlarm(country);
      warnings = warnings.concat(ma);
      if (ma.length > 0) sources.push(`MeteoAlarm (${country})`);
    }

    // Nur aktive/zukünftige Warnungen
    const now = Date.now();
    warnings = warnings.filter(w => new Date(w.end).getTime() > now);

    // Sortierung: Höchste Stufe zuerst, dann nach Start
    warnings.sort((a, b) => b.level - a.level || new Date(a.start).getTime() - new Date(b.start).getTime());

    const result = {
      warnings,
      sources,
      country,
      disclaimer: 'Quelle: Offizielle nationale Wetterdienste via DWD und MeteoAlarm. Im Zweifel originalseite konsultieren.',
      cached: false,
    };

    CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.status(200).json(result);
  } catch (e: any) {
    console.error('[official-warnings]', e);
    return res.status(500).json({ error: e.message });
  }
}
