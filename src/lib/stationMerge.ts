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

const MAX_DIST_KM = 35;
const MAX_AGE_MIN = 90;

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

  if (obs.stationDistanceKm > MAX_DIST_KM || ageMin > MAX_AGE_MIN) {
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
