import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Unified station observation endpoint.
 * Returns the nearest real-world weather station measurement for the given
 * coordinates so the frontend can show a "Jetzt"-Wert that matches reality
 * instead of the ICON model interpolation.
 *
 * Routing:
 *   DE         -> Bright Sky (DWD MOSMIX + SYNOP network)
 *   AT/CH/IT   -> Aviation METAR (nearest airport, global coverage)
 *   else       -> null  (frontend falls back to the model)
 */

const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MEM = new Map<string, { ts: number; data: unknown }>();

export interface StationObservation {
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;        // km/h
  windGust: number | null;         // km/h
  windDirection: number | null;    // deg
  pressure: number | null;         // hPa MSL
  precipitation10min: number | null; // mm in last 10 min
  weatherCode: number | null;      // WMO
  cloudCover: number | null;       // 0..100 %
  visibility: number | null;       // m
  observedAt: string;              // ISO
  stationName: string;
  stationDistanceKm: number;
  source: 'brightsky' | 'metar';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon, country } = req.query as Record<string, string>;
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return res.status(400).json({ error: 'Missing/invalid lat/lon' });
  }
  const cc = (country || '').toUpperCase();

  const key = `${cc}|${latNum.toFixed(2)}|${lonNum.toFixed(2)}`;
  const cached = MEM.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(cached.data);
  }

  try {
    let obs: StationObservation | null = null;
    if (cc === 'DE') obs = await fetchBrightSky(latNum, lonNum);
    if (!obs) obs = await fetchMetar(latNum, lonNum);

    const payload = { observation: obs };
    MEM.set(key, { ts: Date.now(), data: payload });
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(payload);
  } catch (e: any) {
    console.warn('[station] failed', e?.message);
    return res.status(200).json({ observation: null });
  }
}

// -------- Bright Sky (DWD) --------
async function fetchBrightSky(lat: number, lon: number): Promise<StationObservation | null> {
  const url = `https://api.brightsky.dev/current_weather?lat=${lat}&lon=${lon}&units=dwd`;
  const json = await fetchJson(url);
  if (!json) return null;
  const w = json.weather;
  const src = (json.sources && json.sources[0]) || {};
  if (!w) return null;

  const dist = haversineKm(lat, lon, src.lat ?? lat, src.lon ?? lon);
  return {
    temperature: numOrNull(w.temperature),
    apparentTemperature: null,
    humidity: numOrNull(w.relative_humidity),
    windSpeed: numOrNull(w.wind_speed_10),
    windGust: numOrNull(w.wind_gust_speed_10),
    windDirection: numOrNull(w.wind_direction_10),
    pressure: numOrNull(w.pressure_msl),
    precipitation10min: numOrNull(w.precipitation_10),
    weatherCode: brightskyToWmo(w.condition, w.icon),
    visibility: numOrNull(w.visibility),
    observedAt: w.timestamp,
    stationName: src.station_name || src.dwd_station_id || 'DWD-Station',
    stationDistanceKm: round1(dist),
    source: 'brightsky',
  };
}

function brightskyToWmo(condition?: string, icon?: string): number | null {
  // Bright Sky condition: dry, fog, rain, sleet, snow, hail, thunderstorm
  switch (condition) {
    case 'thunderstorm': return 95;
    case 'hail':         return 96;
    case 'snow':         return 73;
    case 'sleet':        return 67;
    case 'rain':         return 63;
    case 'fog':          return 45;
    case 'dry':
      // Use icon for cloud cover hint
      if (icon === 'clear-day' || icon === 'clear-night') return 0;
      if (icon === 'partly-cloudy-day' || icon === 'partly-cloudy-night') return 2;
      if (icon === 'cloudy') return 3;
      return 1;
    default: return null;
  }
}

// -------- METAR (Aviation Weather) --------
async function fetchMetar(lat: number, lon: number): Promise<StationObservation | null> {
  // bbox ±1.5° (~150 km) around target, return closest with valid temp
  const d = 1.5;
  const url = `https://aviationweather.gov/api/data/metar?bbox=${lat - d},${lon - d},${lat + d},${lon + d}&format=json&taf=false&hours=2`;
  const json = await fetchJson(url);
  if (!Array.isArray(json) || json.length === 0) return null;

  let best: any = null;
  let bestDist = Infinity;
  for (const m of json) {
    if (typeof m.lat !== 'number' || typeof m.lon !== 'number') continue;
    if (m.temp == null) continue;
    const d2 = haversineKm(lat, lon, m.lat, m.lon);
    if (d2 < bestDist) { bestDist = d2; best = m; }
  }
  if (!best) return null;

  const windKmh = best.wspd != null ? Math.round(best.wspd * 1.852) : null; // kt -> km/h
  const gustKmh = best.wgst != null ? Math.round(best.wgst * 1.852) : null;
  const pressureHpa = best.altim != null ? Math.round(best.altim) : null;

  return {
    temperature: numOrNull(best.temp),
    apparentTemperature: null,
    humidity: rhFromTempDew(best.temp, best.dewp),
    windSpeed: windKmh,
    windGust: gustKmh,
    windDirection: typeof best.wdir === 'number' ? best.wdir : null,
    pressure: pressureHpa,
    precipitation10min: null, // METAR doesn't give 10-min amount
    weatherCode: metarToWmo(best.wxString),
    visibility: best.visib != null ? Math.round(Number(best.visib) * 1609) : null,
    observedAt: best.reportTime || best.obsTime || new Date().toISOString(),
    stationName: best.name || best.icaoId || 'METAR',
    stationDistanceKm: round1(bestDist),
    source: 'metar',
  };
}

function metarToWmo(wx?: string): number | null {
  if (!wx) return 0;
  const s = wx.toUpperCase();
  if (s.includes('TS')) return s.includes('GR') || s.includes('GS') ? 96 : 95;
  if (s.includes('SN')) return s.startsWith('+') ? 75 : s.startsWith('-') ? 71 : 73;
  if (s.includes('SH')) return s.startsWith('+') ? 82 : s.startsWith('-') ? 80 : 81;
  if (s.includes('FZ') && s.includes('RA')) return 66;
  if (s.includes('DZ')) return 51;
  if (s.includes('RA')) return s.startsWith('+') ? 65 : s.startsWith('-') ? 61 : 63;
  if (s.includes('FG')) return 45;
  if (s.includes('BR') || s.includes('HZ')) return 45;
  return 0;
}

function rhFromTempDew(t?: number | null, td?: number | null): number | null {
  if (t == null || td == null) return null;
  const a = 17.625, b = 243.04;
  const num = Math.exp((a * td) / (b + td));
  const den = Math.exp((a * t) / (b + t));
  return Math.round((100 * num) / den);
}

// -------- utils --------
async function fetchJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'meteoflo/1.0' } });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    clearTimeout(t);
    return null;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function numOrNull(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
