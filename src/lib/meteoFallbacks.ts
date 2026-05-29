import type { WeatherData } from "@/lib/weather";
import type { StationObservation } from "@/hooks/useStationObservation";
import type { OfficialWarning, OfficialWarningsResponse } from "@/hooks/useOfficialWarnings";
import type { RiskWarnings, RiskWarning } from "@/hooks/useRiskWarnings";
import type { SynoptikAnalysis } from "@/hooks/useSynoptikAnalysis";

const EARTH_KM = 6371;

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function n(v: unknown): number | null {
  const num = typeof v === "number" ? v : Number(v);
  return Number.isFinite(num) ? num : null;
}

function cloudCoverFromMetar(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (/\b(CAVOK|SKC|CLR|NSC)\b/.test(raw)) return 0;
  const layers = [...raw.matchAll(/\b(FEW|SCT|BKN|OVC)\d{3}/g)].map((m) => m[1]);
  if (!layers.length) return null;
  if (layers.includes("OVC")) return 100;
  if (layers.includes("BKN")) return 85;
  if (layers.includes("SCT")) return 45;
  if (layers.includes("FEW")) return 20;
  return null;
}

function codeFromMetar(raw: string | null | undefined, cloudCover: number | null): number | null {
  if (!raw) return cloudCover == null ? null : cloudCover >= 85 ? 3 : cloudCover >= 35 ? 2 : cloudCover >= 12 ? 1 : 0;
  if (/\bTS/.test(raw)) return 95;
  if (/\b(SHRA|VCSH|\+SH)/.test(raw)) return 80;
  if (/\b(\+RA|RA\+|\+DZ)/.test(raw)) return 65;
  if (/\b(-RA|-DZ)/.test(raw)) return 61;
  if (/\b(RA|DZ)\b/.test(raw)) return 63;
  if (/\b(\+SN|SN\+|\+SG)/.test(raw)) return 75;
  if (/\b(-SN|-SG)/.test(raw)) return 71;
  if (/\b(SN|SG)\b/.test(raw)) return 73;
  if (/\b(FZRA|FZDZ)/.test(raw)) return 66;
  if (/\b(BR|HZ|FU)\b/.test(raw)) return 45;
  if (/\b(FG|FZFG)\b/.test(raw)) return 48;
  if (cloudCover == null) return null;
  if (cloudCover >= 85) return 3;
  if (cloudCover >= 35) return 2;
  if (cloudCover >= 12) return 1;
  return 0;
}

export async function fetchStationObservationFallback(
  lat: number,
  lon: number,
  country?: string,
): Promise<StationObservation | null> {
  const brightSky = country?.toUpperCase() === "DE" ? await fetchBrightSkyObservation(lat, lon) : null;
  const metar = await fetchNearestMetar(lat, lon);
  const candidates = [brightSky, metar].filter(Boolean) as StationObservation[];
  candidates.sort((a, b) => a.stationDistanceKm - b.stationDistanceKm);
  return candidates[0] ?? null;
}

async function fetchBrightSkyObservation(lat: number, lon: number): Promise<StationObservation | null> {
  try {
    const url = new URL("https://api.brightsky.dev/current_weather");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("max_dist", "15000");
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    const w = json?.weather;
    const s = json?.sources?.[0];
    if (!w || !s) return null;
    const dist = n(s.distance) != null ? Math.round((n(s.distance) ?? 0) / 100) / 10 : distanceKm(lat, lon, n(s.lat) ?? lat, n(s.lon) ?? lon);
    return {
      temperature: n(w.temperature),
      apparentTemperature: null,
      humidity: n(w.relative_humidity),
      windSpeed: n(w.wind_speed),
      windGust: n(w.wind_gust_speed),
      windDirection: n(w.wind_direction),
      pressure: n(w.pressure_msl),
      precipitation10min: n(w.precipitation_10),
      weatherCode: typeof w.condition === "string" ? brightSkyCode(w.condition, n(w.precipitation_10) ?? 0) : null,
      cloudCover: n(w.cloud_cover),
      visibility: n(w.visibility),
      observedAt: String(w.timestamp ?? new Date().toISOString()),
      stationName: String(s.station_name ?? s.id ?? "DWD-Station"),
      stationDistanceKm: dist,
      source: "brightsky",
    };
  } catch {
    return null;
  }
}

function brightSkyCode(condition: string, precip10: number): number {
  const c = condition.toLowerCase();
  if (c.includes("thunder")) return 95;
  if (c.includes("snow")) return precip10 >= 0.5 ? 73 : 71;
  if (c.includes("rain") || c.includes("drizzle")) return precip10 >= 1 ? 63 : 61;
  if (c.includes("fog")) return 45;
  if (c.includes("overcast")) return 3;
  if (c.includes("cloudy")) return 2;
  if (c.includes("clear") || c.includes("dry")) return 0;
  return precip10 >= 0.1 ? 61 : 0;
}

async function fetchNearestMetar(lat: number, lon: number): Promise<StationObservation | null> {
  try {
    const bbox = `${(lon - 0.7).toFixed(3)},${(lat - 0.7).toFixed(3)},${(lon + 0.7).toFixed(3)},${(lat + 0.7).toFixed(3)}`;
    const url = `https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json&hours=2`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    let best: Record<string, unknown> | null = null;
    let bestDist = Infinity;
    for (const row of rows) {
      const rLat = n(row.lat ?? row.latitude);
      const rLon = n(row.lon ?? row.longitude);
      if (rLat == null || rLon == null) continue;
      const dist = distanceKm(lat, lon, rLat, rLon);
      if (dist < bestDist) { best = row; bestDist = dist; }
    }
    if (!best || bestDist > 40) return null;
    const raw = String(best.rawOb ?? best.raw_text ?? "");
    const cloud = n(best.cloud_cover) ?? cloudCoverFromMetar(raw);
    const wx = String(best.wxString ?? best.wx_string ?? "");
    const code = codeFromMetar(wx || raw, cloud);
    return {
      temperature: n(best.temp) ?? n(best.temp_c),
      apparentTemperature: null,
      humidity: null,
      windSpeed: n(best.wspd) != null ? Math.round((n(best.wspd) ?? 0) * 1.852) : null,
      windGust: n(best.wgst) != null ? Math.round((n(best.wgst) ?? 0) * 1.852) : null,
      windDirection: n(best.wdir),
      pressure: n(best.altim) != null ? Math.round((n(best.altim) ?? 0) * 33.8639) : null,
      precipitation10min: code != null && code >= 51 ? 0.2 : 0,
      weatherCode: code,
      cloudCover: cloud,
      visibility: n(best.visib) != null ? Math.round((n(best.visib) ?? 0) * 1609.344) : null,
      observedAt: String(best.reportTime ?? best.obsTime ?? best.observation_time ?? new Date().toISOString()),
      stationName: String(best.name ?? best.icaoId ?? best.icao ?? "METAR"),
      stationDistanceKm: Math.round(bestDist * 10) / 10,
      source: "metar",
    };
  } catch {
    return null;
  }
}

export interface RainbowFallbackItem {
  precipRate: number;
  precipType: "rain" | "snow" | "ice" | "none" | "no_precipitation";
  timestampBegin: number;
  timestampEnd: number;
}

export function rainbowFromOpenMeteoMinutely(weather: WeatherData): { forecast: RainbowFallbackItem[]; summary: { intensity: string } } {
  const m = weather.minutely_15;
  const out: RainbowFallbackItem[] = [];
  for (let i = 0; i < (m?.time?.length ?? 0); i++) {
    const start = new Date(m.time[i]).getTime();
    if (!Number.isFinite(start)) continue;
    const mm15 = Math.max(0, n(m.precipitation?.[i]) ?? 0);
    const code = Math.round(n(m.weather_code?.[i]) ?? 0);
    const type = code >= 71 && code <= 86 ? "snow" : mm15 > 0 ? "rain" : "none";
    out.push({
      precipRate: mm15 * 4,
      precipType: type,
      timestampBegin: Math.floor(start / 1000),
      timestampEnd: Math.floor((start + 15 * 60_000) / 1000),
    });
  }
  const peak = out.reduce((m, it) => Math.max(m, it.precipRate), 0);
  const intensity = peak >= 15 ? "extreme" : peak >= 5 ? "heavy" : peak >= 1.5 ? "moderate" : peak > 0 ? "light" : "none";
  return { forecast: out, summary: { intensity } };
}

export async function fetchRainbowNowcastFallback(lat: number, lon: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    minutely_15: "precipitation,weather_code,temperature_2m,wind_speed_10m",
    forecast_minutely_15: "24",
    timezone: "auto",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("Nowcast nicht verfügbar");
  const json = await res.json();
  return {
    ...rainbowFromOpenMeteoMinutely({ minutely_15: json.minutely_15 } as WeatherData),
    latitude: lat,
    longitude: lon,
    fallback: "open-meteo-minutely",
  };
}

export function buildOfficialWarningsFallback(country: string): OfficialWarningsResponse {
  return {
    warnings: [],
    sources: [country ? `Fallback ${country.toUpperCase()}` : "Fallback"],
    country,
    disclaimer: "Amtliche Warnungen sind in dieser Vorschau nicht direkt erreichbar; lokale Risikoanalyse bleibt aktiv.",
    cached: false,
  };
}

function riskColor(score: number): "green" | "yellow" | "orange" | "red" | "purple" {
  if (score >= 86) return "purple";
  if (score >= 61) return "red";
  if (score >= 31) return "orange";
  if (score >= 11) return "yellow";
  return "green";
}

function thunderScore(weatherData: WeatherData, hours: number): number {
  const h = weatherData.hourly;
  let best = 0;
  const len = Math.min(hours, h.time?.length ?? 0);
  for (let i = 0; i < len; i++) {
    const cape = n(h.cape?.[i]) ?? 0;
    const lpi = n(h.lightning_potential?.[i]) ?? 0;
    const li = n(h.lifted_index?.[i]) ?? 99;
    const gust = n(h.wind_gusts_10m?.[i]) ?? 0;
    let score = 0;
    if (cape >= 2500) score += 70;
    else if (cape >= 1500) score += 55;
    else if (cape >= 800) score += 35;
    else if (cape >= 300) score += 18;
    if (lpi >= 5) score += 30;
    else if (lpi >= 1) score += 15;
    if (li <= -6) score += 15;
    else if (li <= -2) score += 8;
    if (gust >= 55) score += 8;
    best = Math.max(best, Math.min(100, Math.round(score)));
  }
  return best;
}

function thunderLevel(score: number): "kein" | "schwach" | "mäßig" | "hoch" | "extrem" {
  if (score >= 86) return "extrem";
  if (score >= 61) return "hoch";
  if (score >= 31) return "mäßig";
  if (score >= 11) return "schwach";
  return "kein";
}

export function buildRiskWarningsFallback(weatherData: WeatherData, thunderstormScore?: number, officialWarnings?: OfficialWarning[]): RiskWarnings {
  const score = Math.max(thunderstormScore ?? 0, thunderScore(weatherData, 48));
  const warnings: RiskWarning[] = [];
  const next12 = weatherData.hourly.time.slice(0, 12).map((_, i) => ({
    code: weatherData.hourly.weather_code[i] ?? 0,
    precip: weatherData.hourly.precipitation?.[i] ?? 0,
    gust: weatherData.hourly.wind_gusts_10m?.[i] ?? 0,
    snow: weatherData.hourly.snowfall?.[i] ?? 0,
  }));
  const maxPrecip = Math.max(0, ...next12.map((h) => h.precip));
  const maxGust = Math.max(0, ...next12.map((h) => h.gust));
  const maxSnow = Math.max(0, ...next12.map((h) => h.snow));
  if (score >= 31) warnings.push({ id: "fallback-thunder", typ: "Gewitter", stufe: score >= 61 ? "unwetter" : "markant", titel: "Gewitterrisiko", beschreibung: `Konvektive Signale ergeben ${score}% Risiko.`, color: riskColor(score), icon: "Zap" });
  if (maxPrecip >= 5) warnings.push({ id: "fallback-rain", typ: "Starkregen", stufe: maxPrecip >= 15 ? "unwetter" : "markant", titel: "Kräftiger Niederschlag", beschreibung: `Maximal ${maxPrecip.toFixed(1)} mm pro Stunde in den nächsten 12 Stunden.`, color: maxPrecip >= 15 ? "red" : "orange", icon: "CloudRain" });
  if (maxGust >= 55) warnings.push({ id: "fallback-wind", typ: "Wind", stufe: maxGust >= 75 ? "unwetter" : "markant", titel: "Starke Böen", beschreibung: `Böen bis ${Math.round(maxGust)} km/h möglich.`, color: maxGust >= 75 ? "red" : "orange", icon: "Wind" });
  if (maxSnow >= 1) warnings.push({ id: "fallback-snow", typ: "Schnee", stufe: "markant", titel: "Schneefall", beschreibung: `Stündlich bis ${maxSnow.toFixed(1)} cm Schnee möglich.`, color: "yellow", icon: "Snowflake" });
  for (const w of officialWarnings ?? []) {
    warnings.push({ id: `official-${w.id}`, typ: w.type, stufe: w.level >= 3 ? "unwetter" : "markant", titel: w.title, beschreibung: w.description, color: w.level >= 4 ? "purple" : w.level >= 3 ? "red" : "orange", icon: w.type === "thunderstorm" ? "Zap" : w.type === "rain" ? "CloudRain" : w.type === "snow" ? "Snowflake" : "AlertTriangle" });
  }
  return {
    gewitter_risiko_6h: {
      level: thunderLevel(score),
      score,
      begründung: score >= 31 ? "CAPE/LPI/LI/Böen zeigen konvektives Potenzial." : "Keine markanten konvektiven Signale im Kurzfristfenster.",
      color: riskColor(score),
    },
    warnungen_12h: warnings,
    summary: warnings.length ? `${warnings.length} lokale Risikohinweise aus Modell- und Nowcast-Daten.` : "Keine markanten lokalen Risikosignale.",
    disclaimer: "Lokale Fallback-Risikoanalyse, falls KI-/Warn-API nicht erreichbar ist.",
  };
}

export function buildSynoptikFallback(weatherData: WeatherData, locationName = "Standort", thunderstormScore?: number): SynoptikAnalysis {
  const c = weatherData.current;
  const hourly = weatherData.hourly;
  const next24Precip = (hourly.precipitation ?? []).slice(0, 24).reduce((s, v) => s + Math.max(0, v ?? 0), 0);
  const maxGust = Math.max(0, ...(hourly.wind_gusts_10m ?? []).slice(0, 24).map((v) => v ?? 0));
  const score = Math.max(thunderstormScore ?? 0, thunderScore(weatherData, 24));
  return {
    highlight: { text: score >= 31 ? `Konvektive Lage bei ${locationName}: Gewitterpotenzial erhöht.` : `Ruhigere Kurzfristlage bei ${locationName}.` },
    großwetterlage: { klassifikation: maxGust >= 55 ? "Dynamisch" : next24Precip >= 5 ? "Feucht-labil" : "Schwachgradientig", beschreibung: "Fallback aus Ensemblefeldern: Temperatur, Niederschlag, Böen und Konvektionsparametern." },
    aktuell: { lage: `Aktuell ${Math.round(c.temperature_2m)} °C, ${Math.round(c.wind_speed_10m)} km/h Wind, ${Math.round(c.cloud_cover)}% Bewölkung.`, luftmasse: (c.relative_humidity_2m ?? 0) >= 75 ? "feucht" : "mäßig trocken" },
    konvektion: { potenzial: score >= 61 ? "hoch" : score >= 31 ? "mäßig" : score >= 11 ? "schwach" : "kein", score, begründung: score >= 31 ? "Instabilitätsparameter und Böen stützen Schauer-/Gewitterbildung." : "Instabilität und Blitzsignal bleiben niedrig.", typ: score >= 31 ? "Schauer/Gewitter" : "keine markante Konvektion", zeitraum: "nächste 24 h" },
    entwicklung: { next_24h: `Niederschlagssumme ca. ${next24Precip.toFixed(1)} mm, Böen bis ${Math.round(maxGust)} km/h.`, next_48h: "Ensemble-Trend aus den stündlichen Daten beachten; lokale Nowcast-Korrekturen sind priorisiert.", trend_3_7d: "Für Tage 3–7 ist die Unsicherheit höher; Tageswerte dienen als Trend." },
    regionale_besonderheiten: ["Fallback-Analyse ohne externe KI-Antwort", "Stations- und Nowcast-Evidenz werden in der Anzeige zentral verrechnet"],
    großwetterlage_detail: { höhenstruktur: "Aus verfügbaren Druckniveau-Feldern approximiert.", bodendruck: "Bodendrucktendenz in der Vorschau nicht vollständig abgeleitet.", fronten: next24Precip >= 5 ? "Niederschlagszone oder Schauerstaffel möglich." : "Keine markante Frontsignatur aus Fallbackdaten." },
    confidence: { score: weatherData.current._confidence ?? 55, begründung: "Automatisch aus Ensemble-Spreizung und lokaler Evidenz." },
  };
}
