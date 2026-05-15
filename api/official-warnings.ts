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
  areas: string[];
  start: string;
  end: string;
  url?: string;
};

type WarningCenter = { lat: number; lon: number };

function isPointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const intersect = ((latI > lat) !== (latJ > lat)) &&
                      (lon < (lonJ - lonI) * (lat - latI) / (latJ - latI) + lonI);
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToPolygonCenter(lat: number, lon: number, polygon: number[][]): number {
  const centerLat = polygon.reduce((s, c) => s + c[0], 0) / polygon.length;
  const centerLon = polygon.reduce((s, c) => s + c[1], 0) / polygon.length;
  const dLat = (centerLat - lat) * 111;
  const dLon = (centerLon - lon) * 111 * Math.cos(lat * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function deduplicateWarnings(warnings: OfficialWarning[]): OfficialWarning[] {
  const groups = new Map<string, OfficialWarning[]>();
  for (const w of warnings) {
    const startHour = Math.floor(new Date(w.start).getTime() / (60 * 60 * 1000));
    const endHour = Math.floor(new Date(w.end).getTime() / (60 * 60 * 1000));
    const key = `${w.source}_${w.type}_${w.level}_${startHour}_${endHour}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w);
  }
  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    const areas = Array.from(new Set(group.flatMap((w) => w.areas))).filter(Boolean);
    return {
      ...first,
      id: `${first.source}_${first.type}_${first.level}_${first.start}`,
      areas: areas.length > 0 ? areas : ['Region'],
    };
  });
}


function extractPolygonCoords(polygon: any, format: 'latlon' | 'lonlat' = 'latlon'): number[][] {
  if (typeof polygon === 'string') {
    return polygon
      .split(' ')
      .map((pair) => {
        const [latStr, lonStr] = pair.split(',');
        return [parseFloat(latStr), parseFloat(lonStr)];
      })
      .filter((c) => !isNaN(c[0]) && !isNaN(c[1]));
  }

  if (!Array.isArray(polygon)) return [];

  const coords: number[][] = [];
  const walk = (value: any) => {
    if (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      coords.push(format === 'lonlat' ? [value[1], value[0]] : [value[0], value[1]]);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
  };
  walk(polygon);
  return coords.filter((c) => !isNaN(c[0]) && !isNaN(c[1]));
}

function centerFromCoords(coords: number[][]): WarningCenter | null {
  if (coords.length === 0) return null;
  return {
    lat: coords.reduce((s, c) => s + c[0], 0) / coords.length,
    lon: coords.reduce((s, c) => s + c[1], 0) / coords.length,
  };
}

function centerFromGeometry(geom: any): WarningCenter | null {
  if (!geom) return null;
  if (Array.isArray(geom.bbox) && geom.bbox.length >= 4) {
    return { lat: (Number(geom.bbox[1]) + Number(geom.bbox[3])) / 2, lon: (Number(geom.bbox[0]) + Number(geom.bbox[2])) / 2 };
  }
  if (geom.polygon) return centerFromCoords(extractPolygonCoords(geom.polygon));
  if (geom.coordinates) return centerFromCoords(extractPolygonCoords(geom.coordinates, 'lonlat'));
  return null;
}

function polygonsFromGeometry(geom: any): number[][][] {
  if (!geom) return [];
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    return geom.coordinates.map((ring: any[]) => ring.map((c: any) => [Number(c[1]), Number(c[0])]));
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    const rings: number[][][] = [];
    for (const poly of geom.coordinates) {
      for (const ring of poly) rings.push(ring.map((c: any) => [Number(c[1]), Number(c[0])]));
    }
    return rings;
  }
  if (geom.polygon) {
    const polys = Array.isArray(geom.polygon) && typeof geom.polygon[0] === 'string' ? geom.polygon : [geom.polygon];
    return polys.map((p: any) => extractPolygonCoords(p)).filter((c: number[][]) => c.length > 0);
  }
  return [];
}

async function fetchDWDWarnCellPolygons(cellIds: string[]): Promise<Record<string, number[][][]>> {
  const numericIds = cellIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (numericIds.length === 0) return {};

  const cql = encodeURIComponent(`WARNCELLID IN (${numericIds.join(',')})`);
  const url = `https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dwd:Warngebiete_Kreise&outputFormat=json&CQL_FILTER=${cql}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'MeteoFlo/1.0 (non-commercial weather app)' } });
  if (!r.ok) throw new Error(`DWD geometries ${r.status}`);

  const geo = await r.json();
  const out: Record<string, number[][][]> = {};
  for (const feature of geo.features || []) {
    const id = String(feature.properties?.WARNCELLID || '');
    const polys = polygonsFromGeometry(feature.geometry);
    if (id && polys.length > 0) out[id] = polys;
  }
  return out;
}

async function fetchDWDWarnings(lat: number, lon: number): Promise<OfficialWarning[]> {
  try {
    const r = await fetch('https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json', {
      headers: { 'User-Agent': 'MeteoFlo/1.0 (non-commercial weather app)' }
    });
    if (!r.ok) throw new Error(`DWD ${r.status}`);

    const text = await r.text();
    const jsonStart = text.indexOf('({');
    const jsonEnd = text.lastIndexOf('})');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('DWD format');

    const data = JSON.parse(text.substring(jsonStart + 1, jsonEnd + 1));
    const warnings: OfficialWarning[] = [];
    const BUFFER_KM = 20;
    const warningCells = data.warnings || {};
    const geometries = data.geometries || {};
    const cellIds = Object.keys(warningCells);
    const totalCount = cellIds.reduce((sum, cellId) => sum + (Array.isArray(warningCells[cellId]) ? warningCells[cellId].length : 0), 0);

    let cellPolygons: Record<string, number[][][]> = {};
    if (Object.keys(geometries).length > 0) {
      for (const cellId of cellIds) {
        const polys = polygonsFromGeometry(geometries[cellId]);
        if (polys.length > 0) cellPolygons[cellId] = polys;
      }
    }
    const missing = cellIds.filter((id) => !cellPolygons[id]);
    if (missing.length > 0) {
      try {
        const fetched = await fetchDWDWarnCellPolygons(missing);
        cellPolygons = { ...cellPolygons, ...fetched };
      } catch (e) {
        console.error('[DWD WFS]', e);
      }
    }

    for (const cellId of cellIds) {
      const polys = cellPolygons[cellId];
      if (!polys || polys.length === 0) continue;

      const inside = polys.some((p) => isPointInPolygon(lat, lon, p));
      let nearby = false;
      if (!inside) {
        const minDist = Math.min(...polys.map((p) => distanceToPolygonCenter(lat, lon, p)));
        nearby = minDist <= BUFFER_KM;
      }
      if (!inside && !nearby) continue;

      for (const w of warningCells[cellId]) {
        warnings.push({
          id: `dwd_${cellId}_${w.start}_${w.event}`,
          source: 'DWD',
          type: DWD_TYPE_MAP[String(w.eventCode ?? w.type)] || 'other',
          level: Math.min(4, Math.max(1, Number(w.level))) as 1|2|3|4,
          title: w.headline || w.event,
          description: w.description || '',
          areas: [w.regionName || 'Unbekannte Region'],
          start: new Date(w.start).toISOString(),
          end: new Date(w.end).toISOString(),
          url: 'https://www.dwd.de/DE/wetter/warnungen/warnungen_node.html',
        });
      }
    }

    console.log(`[DWD] Total warnings: ${totalCount}, after geo-filter: ${warnings.length}`);
    return warnings;
  } catch (e) {
    console.error('[DWD]', e);
    return [];
  }
}

const IT_REGIONS: Record<string, [number, number, number, number]> = {
  "Valle d'Aosta": [45.46, 45.99, 6.79, 7.94],
  "Piemonte": [44.05, 46.46, 6.62, 9.21],
  "Lombardia": [44.67, 46.64, 8.50, 11.43],
  "Liguria": [43.78, 44.68, 7.49, 10.07],
  "Trentino-Alto Adige": [45.67, 47.09, 10.38, 12.48],
  "Trentino": [45.67, 46.53, 10.45, 11.96],
  "Alto Adige": [46.21, 47.09, 10.38, 12.48],
  "Veneto": [44.79, 46.68, 10.62, 13.10],
  "Friuli-Venezia Giulia": [45.58, 46.65, 12.32, 13.92],
  "Emilia-Romagna": [43.74, 45.14, 9.20, 12.75],
  "Toscana": [42.24, 44.47, 9.69, 12.37],
  "Umbria": [42.36, 43.62, 11.89, 13.27],
  "Marche": [42.69, 43.97, 12.18, 13.92],
  "Lazio": [40.78, 42.85, 11.45, 14.03],
  "Abruzzo": [41.68, 42.90, 13.01, 14.79],
  "Molise": [41.36, 42.06, 14.16, 15.16],
  "Campania": [39.99, 41.51, 13.76, 15.81],
  "Puglia": [39.78, 42.22, 14.92, 18.52],
  "Basilicata": [39.89, 41.14, 15.34, 16.87],
  "Calabria": [37.91, 40.15, 15.63, 17.21],
  "Sicilia": [35.49, 38.81, 11.93, 15.65],
  "Sardegna": [38.85, 41.31, 8.13, 9.84],
};

const AT_REGIONS: Record<string, [number, number, number, number]> = {
  "Burgenland": [46.84, 48.12, 16.07, 17.16],
  "Kärnten": [46.37, 47.13, 12.66, 15.06],
  "Niederösterreich": [47.42, 49.02, 14.43, 17.07],
  "Oberösterreich": [47.45, 48.77, 12.74, 15.00],
  "Salzburg": [46.96, 48.05, 12.07, 14.04],
  "Steiermark": [46.65, 47.83, 13.55, 16.17],
  "Tirol": [46.65, 47.74, 10.10, 12.96],
  "Vorarlberg": [46.84, 47.61, 9.53, 10.24],
  "Wien": [48.12, 48.32, 16.18, 16.58],
};

const CH_REGIONS: Record<string, [number, number, number, number]> = {
  "Zürich": [47.16, 47.69, 8.36, 8.98],
  "Bern": [46.32, 47.34, 6.86, 8.46],
  "Genève": [46.13, 46.38, 5.96, 6.31],
  "Ticino": [45.82, 46.62, 8.39, 9.30],
  "Graubünden": [46.17, 47.06, 8.69, 10.49],
};

function getUserRegion(lat: number, lon: number, country: string): string | null {
  const map = country === 'IT' ? IT_REGIONS
            : country === 'AT' ? AT_REGIONS
            : country === 'CH' ? CH_REGIONS
            : null;
  if (!map) return null;
  for (const [name, [minLat, maxLat, minLon, maxLon]] of Object.entries(map)) {
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) return name;
  }
  return null;
}

function regionMatches(warningArea: string, userRegion: string): boolean {
  if (!warningArea || !userRegion) return false;
  const a = warningArea.toLowerCase();
  const u = userRegion.toLowerCase();
  return a.includes(u) || u.includes(a);
}

const TITLE_MAP: Record<string, string> = {
  'Yellow': 'Markante',
  'Orange': 'Unwetter-',
  'Red': 'Extreme',
  'Thunderstorm Warning': 'Gewitterwarnung',
  'Wind Warning': 'Windwarnung',
  'Rain Warning': 'Regenwarnung',
  'Snow/Ice Warning': 'Schnee-/Glättewarnung',
  'Snow Warning': 'Schneewarnung',
  'Ice Warning': 'Glättewarnung',
  'Extreme high temperature Warning': 'Hitzewarnung',
  'Extreme low temperature Warning': 'Kältewarnung',
  'Fog Warning': 'Nebelwarnung',
  'Coastal Event Warning': 'Küstenwarnung',
  'Forest fire Warning': 'Waldbrandwarnung',
  'Avalanches Warning': 'Lawinenwarnung',
  'Flood Warning': 'Hochwasserwarnung',
  'Rain-Flood Warning': 'Regen- und Hochwasserwarnung',
};

const DESC_MAP: Record<string, string> = {
  'Moderate intensity weather phenomena expected': 'Mäßige Wettererscheinungen erwartet',
  'Severe weather expected': 'Schwerwiegende Wettererscheinungen erwartet',
  'Extreme weather expected': 'Extreme Wettererscheinungen erwartet',
  'Significant weather phenomena expected': 'Markante Wettererscheinungen erwartet',
};

function translateTitle(title: string): string {
  let result = title;
  for (const [en, de] of Object.entries(TITLE_MAP)) {
    result = result.replace(new RegExp(en, 'gi'), de);
  }
  return result.replace(/\s+/g, ' ').trim();
}

function translateDescription(desc: string): string {
  let result = desc;
  for (const [en, de] of Object.entries(DESC_MAP)) {
    result = result.replace(new RegExp(en, 'gi'), de);
  }
  return result;
}

function cleanDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/\(DISCLAIMER:[\s\S]*?\)/g, '')
    .replace(/DISCLAIMER:.*$/gs, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchMeteoAlarm(country: string, lat: number, lon: number): Promise<OfficialWarning[]> {
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

    const userRegion = getUserRegion(lat, lon, country);
    console.log(`[MeteoAlarm-${country}] User region detected: ${userRegion || 'none (fallback: all)'}`);

    const warnings: OfficialWarning[] = [];
    let loggedStructure = false;
    let filteredOutByRegion = 0;
    for (const warn of data.warnings || []) {
      const props = warn.properties || {};
      const alert = warn.alert || {};
      const info = alert.info?.[0] || {};
      const params = Object.fromEntries((info.parameter || []).map((p: any) => [p.valueName, p.value]));
      const area = info.area?.[0] || {};
      const center = centerFromGeometry(warn.geometry);
      if (!loggedStructure) {
        console.log('[MeteoAlarm] Structure', {
          country,
          hasGeometry: Boolean(warn.geometry),
          geometryType: warn.geometry?.type,
          propertyKeys: Object.keys(props),
          alertKeys: Object.keys(alert),
          infoKeys: Object.keys(info),
          areaKeys: Object.keys(area),
          geocode: area.geocode,
          areaDescSample: props.areaDesc || area.areaDesc,
        });
        loggedStructure = true;
      }
      if (center && (Math.abs(center.lat - lat) > 2 || Math.abs(center.lon - lon) > 2)) continue;

      const areaDesc = props.areaDesc || area.areaDesc || '';
      if (userRegion && !regionMatches(areaDesc, userRegion)) {
        filteredOutByRegion++;
        continue;
      }

      const level = Math.min(4, Math.max(1, Number(String(props.awareness_level?.[0] || params.awareness_level || '').split(';')[0]) || 2)) as 1|2|3|4;
      const rawTitle = props.event || info.event || info.headline || 'Wetterwarnung';
      const rawDesc = props.description || props.instruction || info.description || info.instruction || '';
      warnings.push({
        id: `meteoalarm_${slug}_${warn.id || warn.uuid || alert.identifier}`,
        source: `MeteoAlarm-${country}`,
        type: mapMeteoAlarmType(props.awareness_type?.[0] || String(params.awareness_type || '').split(';')[0]),
        level,
        title: translateTitle(rawTitle),
        description: translateDescription(cleanDescription(rawDesc)),
        areas: [areaDesc || 'Region'],
        start: props.onset || info.onset || new Date().toISOString(),
        end: props.expires || info.expires || new Date(Date.now() + 12*3600*1000).toISOString(),
        url: props.web || info.web || 'https://www.meteoalarm.org',
      });
    }
    console.log(`[MeteoAlarm-${country}] Total: ${(data.warnings || []).length}, region-filtered out: ${filteredOutByRegion}, kept: ${warnings.length}`);
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
      const ma = await fetchMeteoAlarm(country, lat, lon);
      warnings = warnings.concat(ma);
      if (ma.length > 0) sources.push(`MeteoAlarm (${country})`);
    }

    // Nur aktive/zukünftige Warnungen
    const now = Date.now();
    warnings = warnings.filter(w => new Date(w.end).getTime() > now);

    // Deduplizierung: gleiche Warnungen (type/level/Zeitraum) → eine Karte mit mehreren Regionen
    warnings = deduplicateWarnings(warnings);

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
