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

type WarningCenter = { lat: number; lon: number };

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

async function fetchDWDWarnCellCenters(cellIds: string[]): Promise<Record<string, WarningCenter>> {
  const numericIds = cellIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  if (numericIds.length === 0) return {};

  const cql = encodeURIComponent(`WARNCELLID IN (${numericIds.join(',')})`);
  const url = `https://maps.dwd.de/geoserver/dwd/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dwd:Warngebiete_Kreise&outputFormat=json&CQL_FILTER=${cql}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'MeteoFlo/1.0 (non-commercial weather app)' } });
  if (!r.ok) throw new Error(`DWD geometries ${r.status}`);

  const geo = await r.json();
  const centers: Record<string, WarningCenter> = {};
  for (const feature of geo.features || []) {
    const id = String(feature.properties?.WARNCELLID || '');
    const center = centerFromGeometry({ ...feature.geometry, bbox: feature.bbox });
    if (id && center) centers[id] = center;
  }
  return centers;
}

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
    const BBOX_LAT = 1.0;
    const BBOX_LON = 1.5;
    const warningCells = data.warnings || {};
    const geometries = data.geometries || {};
    const cellIds = Object.keys(warningCells);
    const totalCount = cellIds.reduce((sum, cellId) => sum + (Array.isArray(warningCells[cellId]) ? warningCells[cellId].length : 0), 0);
    let warnCellCenters: Record<string, WarningCenter> = {};

    if (Object.keys(geometries).length > 0) {
      for (const cellId of cellIds) {
        const center = centerFromGeometry(geometries[cellId]);
        if (center) warnCellCenters[cellId] = center;
      }
    } else {
      warnCellCenters = await fetchDWDWarnCellCenters(cellIds);
    }

    // data.warnings ist ein Object mit warnCellId als key, Array als value
    for (const cellId of cellIds) {
      const center = warnCellCenters[cellId];
      if (!center) continue;
      if (Math.abs(center.lat - lat) > BBOX_LAT || Math.abs(center.lon - lon) > BBOX_LON) continue;

      for (const w of warningCells[cellId]) {
        warnings.push({
          id: `dwd_${cellId}_${w.start}_${w.event}`,
          source: 'DWD',
          type: DWD_TYPE_MAP[String(w.eventCode ?? w.type)] || 'other',
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

    console.log(`[DWD] Total warnings: ${totalCount}, after geo-filter: ${warnings.length}`);
    return warnings;
  } catch (e) {
    console.error('[DWD]', e);
    return [];
  }
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

    const warnings: OfficialWarning[] = [];
    let loggedStructure = false;
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
        });
        loggedStructure = true;
      }
      if (center && (Math.abs(center.lat - lat) > 2 || Math.abs(center.lon - lon) > 2)) continue;

      const level = Math.min(4, Math.max(1, Number(String(props.awareness_level?.[0] || params.awareness_level || '').split(';')[0]) || 2)) as 1|2|3|4;
      warnings.push({
        id: `meteoalarm_${slug}_${warn.id || warn.uuid || alert.identifier}`,
        source: `MeteoAlarm-${country}`,
        type: mapMeteoAlarmType(props.awareness_type?.[0] || String(params.awareness_type || '').split(';')[0]),
        level,
        title: props.event || info.event || info.headline || 'Wetterwarnung',
        description: props.description || props.instruction || info.description || info.instruction || '',
        area: props.areaDesc || area.areaDesc || 'Region',
        start: props.onset || info.onset || new Date().toISOString(),
        end: props.expires || info.expires || new Date(Date.now() + 12*3600*1000).toISOString(),
        url: props.web || info.web || 'https://www.meteoalarm.org',
      });
    }
    console.log(`[MeteoAlarm-${country}] Total warnings: ${(data.warnings || []).length}, after geo-filter: ${warnings.length}`);
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
