import type { WeatherData, CurrentWeather } from "@/lib/weather";
import type { StationObservation } from "@/hooks/useStationObservation";

export interface StationMeta {
  name: string;
  distanceKm: number;
  ageMin: number;
  source: "brightsky" | "metar";
}

export interface CurrentWithSource extends CurrentWeather {
  _source?: "station" | "model";
  _station?: StationMeta;
}

// Source-specific thresholds. METAR sind Flughafen-Stationen und oft
// 20–40 km vom eigentlichen Ort entfernt — bei dieser Distanz spiegelt der
// Flughafenzustand das lokale Wetter nicht zuverlässig wider (z.B. trockener
// Flughafen während im Umland eine Gewitterzelle steht). Bright Sky deckt
// das DWD-Netz dicht ab und darf großzügiger gelten.
const MAX_DIST_KM_BRIGHTSKY = 15;
const MAX_DIST_KM_METAR = 15;
const MAX_AGE_MIN = 60;

/**
 * Merge a real-world station observation into the model "current" block.
 * Only fields the station reports get overridden — model-only fields
 * (UV, CAPE, pressure-levels, ...) remain untouched.
 *
 * The station wins when it is < MAX_DIST_KM away and < MAX_AGE_MIN old.
 * Otherwise the model value stays and `_source = "model"`.
 */
export function mergeStationIntoWeather(
  data: WeatherData,
  obs: StationObservation | null,
): WeatherData {
  const current = data.current as CurrentWithSource;

  if (!obs || obs.temperature == null) {
    return { ...data, current: { ...current, _source: "model" } };
  }

  const ageMin = Math.max(
    0,
    Math.round((Date.now() - new Date(obs.observedAt).getTime()) / 60000),
  );

  const maxDist = obs.source === "metar" ? MAX_DIST_KM_METAR : MAX_DIST_KM_BRIGHTSKY;
  if (obs.stationDistanceKm > maxDist || ageMin > MAX_AGE_MIN) {
    return { ...data, current: { ...current, _source: "model" } };
  }

  const merged: CurrentWithSource = {
    ...current,
    temperature_2m: obs.temperature ?? current.temperature_2m,
    apparent_temperature:
      obs.apparentTemperature ??
      derivedFeelsLike(obs.temperature, obs.windSpeed, obs.humidity) ??
      current.apparent_temperature,
    relative_humidity_2m: obs.humidity ?? current.relative_humidity_2m,
    wind_speed_10m: obs.windSpeed ?? current.wind_speed_10m,
    wind_gusts_10m: obs.windGust ?? current.wind_gusts_10m,
    wind_direction_10m: obs.windDirection ?? current.wind_direction_10m,
    pressure_msl: obs.pressure ?? current.pressure_msl,
    // Modell-Stundenwert bleibt erhalten (für Risiko/Beschreibungs-Logik),
    // die echte 10-Min-Summe der Station wird in einem separaten Feld geführt.
    precipitation: current.precipitation,
    precipitation_10min:
      obs.precipitation10min != null && Number.isFinite(obs.precipitation10min)
        ? Math.max(0, obs.precipitation10min)
        : undefined,
    cloud_cover: obs.cloudCover != null ? obs.cloudCover : current.cloud_cover,
    weather_code: reconcileCode(current.weather_code, obs),
    _source: "station",
    _station: {
      name: obs.stationName,
      distanceKm: obs.stationDistanceKm,
      ageMin,
      source: obs.source,
    },
    // Station = ground truth, override ensemble confidence
    _confidence: 100,
    _diagnostics: { ...current._diagnostics, stationApplied: true },
  };

  return { ...data, current: merged };
}

/**
 * Apply station evidence to the model weather_code so icons/text match
 * what's actually happening outside.
 */
function reconcileCode(modelCode: number, obs: StationObservation): number {
  // Station reports rain/snow/thunder -> trust station classification
  if (obs.weatherCode != null && obs.weatherCode >= 45) return obs.weatherCode;

  // Cloud-cover wins over model when it disagrees with sky condition
  if (obs.cloudCover != null) {
    if (obs.cloudCover <= 15 && modelCode >= 2 && modelCode < 45) {
      // Model says cloudy/overcast, station sees clear sky
      return obs.weatherCode === 0 || obs.weatherCode === 1 ? obs.weatherCode : 0;
    }
    if (obs.cloudCover >= 85 && modelCode <= 1) {
      // Model says clear, station sees overcast
      return 3;
    }
    if (obs.cloudCover >= 40 && obs.cloudCover < 85 && (modelCode === 0 || modelCode === 3)) {
      return 2;
    }
  }

  // Station reports dry but model says precipitation
  if (
    obs.precipitation10min === 0 &&
    modelCode >= 51 &&
    modelCode < 95
  ) {
    return obs.weatherCode ?? (obs.cloudCover != null && obs.cloudCover < 30 ? 1 : 3);
  }

  // Visibility good but model says fog
  if (
    (modelCode === 45 || modelCode === 48) &&
    obs.visibility != null &&
    obs.visibility > 5000
  ) {
    return 3;
  }

  return modelCode;
}

const THUNDER_CODE = (c: number) => c === 95 || c === 96 || c === 99;
const PRECIP_CODE = (c: number) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86);

function upgradeForMm(mm: number): number {
  if (mm >= 2.5) return 63;
  if (mm >= 0.5) return 61;
  return 51;
}

/**
 * Wendet Minutely-Nowcast-Evidenz aus Open-Meteo auf den aktuellen Wettercode
 * UND die ersten Stundenwerte an — zeitstempelbasiert, damit vergangene
 * Slots nichts mehr verfälschen. Gewittercodes bleiben unverändert.
 */
export function applyNowcastEvidence(data: WeatherData): WeatherData {
  const m = data.minutely_15;
  if (!m || !Array.isArray(m.time) || !Array.isArray(m.precipitation) || m.time.length === 0) {
    return data;
  }

  const nowMs = Date.now();
  // Slots der nächsten 30 Minuten (2 × 15-Min) ab jetzt
  let nextPrecip = 0;
  let firstFutureCode: number | undefined;
  let used = 0;
  for (let i = 0; i < m.time.length && used < 2; i++) {
    const ts = new Date(m.time[i]).getTime();
    // Slot abgelaufen?
    if (ts + 15 * 60 * 1000 < nowMs) continue;
    if (ts > nowMs + 60 * 60 * 1000) break;
    nextPrecip += Math.max(0, m.precipitation[i] ?? 0);
    if (firstFutureCode == null) firstFutureCode = m.weather_code?.[i];
    used++;
  }

  let next = data;
  if (nextPrecip >= 0.2) {
    next = applyEvidenceToCurrent(next, nextPrecip, firstFutureCode);
    next = overlayPrecipOnHourly(next, nextPrecip, firstFutureCode);
  }
  return next;
}

/**
 * Wendet Rainbow.ai-Radarnowcast-Evidenz an (mm/h × Dauer) — wird im
 * WeatherProvider zusätzlich angewandt, sobald Daten verfügbar sind.
 */
export function applyRainbowEvidence(
  data: WeatherData,
  items: Array<{ precipRate: number; precipType: string; timestampBegin: number; timestampEnd: number }> | null | undefined,
): WeatherData {
  if (!Array.isArray(items) || items.length === 0) return data;
  const nowSec = Date.now() / 1000;
  const horizonSec = nowSec + 30 * 60;

  let mmNext30 = 0;
  let currentlyRaining = false;
  for (const it of items) {
    if (typeof it.timestampBegin !== "number" || typeof it.timestampEnd !== "number") continue;
    if (it.timestampEnd <= nowSec) continue;
    if (it.timestampBegin >= horizonSec) continue;
    const rate = Number.isFinite(it.precipRate) ? Math.max(0, it.precipRate) : 0;
    if (rate <= 0) continue;
    if (it.precipType === "none" || it.precipType === "no_precipitation") continue;
    const begin = Math.max(it.timestampBegin, nowSec);
    const end = Math.min(it.timestampEnd, horizonSec);
    const durH = Math.max(0, (end - begin) / 3600);
    mmNext30 += rate * durH;
    if (it.timestampBegin <= nowSec && it.timestampEnd > nowSec) currentlyRaining = true;
  }

  if (!currentlyRaining && mmNext30 < 0.2) return data;

  let next = data;
  next = applyEvidenceToCurrent(next, Math.max(mmNext30, currentlyRaining ? 0.3 : 0), undefined);
  next = overlayPrecipOnHourly(next, mmNext30, undefined);
  return next;
}

function applyEvidenceToCurrent(
  data: WeatherData,
  mm: number,
  evidenceCode: number | undefined,
): WeatherData {
  const current = data.current as CurrentWithSource;
  const code = current.weather_code;
  if (THUNDER_CODE(code)) return data;
  if (PRECIP_CODE(code)) {
    return {
      ...data,
      current: {
        ...current,
        precipitation: Math.max(current.precipitation ?? 0, mm),
        _diagnostics: { ...current._diagnostics, nowcastApplied: true },
      },
    };
  }
  const upgraded =
    evidenceCode != null && (PRECIP_CODE(evidenceCode) || THUNDER_CODE(evidenceCode))
      ? evidenceCode
      : upgradeForMm(mm);
  return {
    ...data,
    current: {
      ...current,
      weather_code: upgraded,
      precipitation: Math.max(current.precipitation ?? 0, mm),
      _diagnostics: { ...current._diagnostics, nowcastApplied: true },
    },
  };
}

function overlayPrecipOnHourly(
  data: WeatherData,
  mmNext30: number,
  evidenceCode: number | undefined,
): WeatherData {
  const h = data.hourly;
  if (!h?.time?.length) return data;
  const nowMs = Date.now();
  // Index der aktuellen Stunde (oder nächste)
  let idx = -1;
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts + 60 * 60 * 1000 > nowMs) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return data;
  const precip = [...(h.precipitation ?? [])];
  const codes = [...h.weather_code];
  // mmNext30 ist eine 30-Min-Summe → in die aktuelle Stunde projizieren
  const projHourMm = Math.min(50, mmNext30 * 2);
  if (precip[idx] != null) {
    precip[idx] = Math.max(precip[idx] ?? 0, projHourMm);
  }
  const c = codes[idx];
  if (!THUNDER_CODE(c) && projHourMm >= 0.1) {
    if (!PRECIP_CODE(c)) {
      codes[idx] =
        evidenceCode != null && (PRECIP_CODE(evidenceCode) || THUNDER_CODE(evidenceCode))
          ? evidenceCode
          : upgradeForMm(projHourMm);
    }
  }
  return {
    ...data,
    hourly: { ...h, precipitation: precip, weather_code: codes },
  };
}


// Simple wind-chill / heat-index hybrid; falls back to temperature.
function derivedFeelsLike(
  t: number | null,
  windKmh: number | null,
  rh: number | null,
): number | null {
  if (t == null) return null;
  if (t <= 10 && windKmh != null && windKmh >= 5) {
    // Wind chill (Canadian formula)
    return (
      Math.round(
        (13.12 +
          0.6215 * t -
          11.37 * Math.pow(windKmh, 0.16) +
          0.3965 * t * Math.pow(windKmh, 0.16)) *
          10,
      ) / 10
    );
  }
  if (t >= 27 && rh != null && rh >= 40) {
    // Approx heat index (Rothfusz, °C)
    const hi =
      -8.78469 +
      1.61139 * t +
      2.33854 * rh -
      0.14611 * t * rh -
      0.012308 * t * t -
      0.016425 * rh * rh +
      0.002211 * t * t * rh +
      0.00072546 * t * rh * rh -
      0.000003582 * t * t * rh * rh;
    return Math.round(hi * 10) / 10;
  }
  return t;
}
