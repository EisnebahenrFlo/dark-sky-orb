import type { WeatherData, CurrentWeather } from "@/lib/weather";
import { wmoCodeForPrecipRate } from "@/lib/weather";
import type { StationObservation } from "@/hooks/useStationObservation";
import type { OfficialWarning } from "@/hooks/useOfficialWarnings";

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

const MAX_DIST_KM_BRIGHTSKY = 15;
const MAX_DIST_KM_METAR = 15;
const MAX_AGE_MIN = 60;

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

  const stationPrecip10 =
    obs.precipitation10min != null && Number.isFinite(obs.precipitation10min)
      ? Math.max(0, obs.precipitation10min)
      : undefined;
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
    precipitation: current.precipitation,
    precipitation_10min: stationPrecip10,
    cloud_cover: obs.cloudCover != null ? obs.cloudCover : current.cloud_cover,
    weather_code: reconcileCode(current.weather_code, obs),
    _source: "station",
    _station: {
      name: obs.stationName,
      distanceKm: obs.stationDistanceKm,
      ageMin,
      source: obs.source,
    },
    _confidence: 100,
    _codeContext: {
      ...(current._codeContext ?? {}),
      stationCode: obs.weatherCode ?? undefined,
      stationPrecip10,
    },
    _diagnostics: { ...current._diagnostics, stationApplied: true },
  };


  return { ...data, current: merged };
}

function reconcileCode(modelCode: number, obs: StationObservation): number {
  if (obs.weatherCode != null && obs.weatherCode >= 45) return obs.weatherCode;

  if (obs.cloudCover != null) {
    if (obs.cloudCover <= 15 && modelCode >= 2 && modelCode < 45) {
      return obs.weatherCode === 0 || obs.weatherCode === 1 ? obs.weatherCode : 0;
    }
    if (obs.cloudCover >= 85 && modelCode <= 1) {
      return 3;
    }
    if (obs.cloudCover >= 40 && obs.cloudCover < 85 && (modelCode === 0 || modelCode === 3)) {
      return 2;
    }
  }

  if (
    obs.precipitation10min === 0 &&
    modelCode >= 51 &&
    modelCode < 95
  ) {
    return obs.weatherCode ?? (obs.cloudCover != null && obs.cloudCover < 30 ? 1 : 3);
  }

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

/** Find hourly index closest to `current.time`. */
function nowHourlyIdx(data: WeatherData): number {
  const times = data.hourly?.time;
  if (!Array.isArray(times) || !times.length) return -1;
  const nowMs = new Date(data.current.time).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - nowMs);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

/**
 * Read convective context for the current/next hour from model fields.
 * Returns whether convection is plausible (drives showers vs steady rain)
 * and whether outright lightning is likely.
 */
function readConvectiveContext(data: WeatherData): {
  convective: boolean;
  lightning: boolean;
  severeLightning: boolean;
  maxLpi: number;
} {
  const idx = nowHourlyIdx(data);
  if (idx < 0) return { convective: false, lightning: false, severeLightning: false, maxLpi: 0 };
  const h = data.hourly;
  const lpiArr = h.lightning_potential ?? [];
  const capeArr = h.cape ?? [];
  const liArr = h.lifted_index ?? [];
  // current + next 2 hours
  let maxLpi = 0;
  let maxCape = 0;
  let minLi = 99;
  for (let i = idx; i < Math.min(h.time.length, idx + 3); i++) {
    const lp = Number(lpiArr[i]); if (Number.isFinite(lp)) maxLpi = Math.max(maxLpi, lp);
    const cp = Number(capeArr[i]); if (Number.isFinite(cp)) maxCape = Math.max(maxCape, cp);
    const li = Number(liArr[i]); if (Number.isFinite(li)) minLi = Math.min(minLi, li);
  }
  const convective = maxLpi >= 1 || maxCape >= 500 || minLi <= -2;
  const lightning = maxLpi >= 2 || (maxCape >= 800 && minLi <= -2);
  const severeLightning = maxLpi >= 5 || (maxCape >= 2000 && minLi <= -4);
  return { convective, lightning, severeLightning, maxLpi };
}

/**
 * Apply Open-Meteo minutely_15 nowcast evidence + LPI to current & first hour.
 */
export function applyNowcastEvidence(data: WeatherData): WeatherData {
  const m = data.minutely_15;
  if (!m || !Array.isArray(m.time) || !Array.isArray(m.precipitation) || m.time.length === 0) {
    return data;
  }

  const nowMs = Date.now();
  let nextPrecip = 0;
  let firstFutureCode: number | undefined;
  let used = 0;
  let minutesCovered = 0;
  // „jetzt": erster Slot, der den aktuellen Zeitpunkt enthält (≤ 15 min alt
  // oder beginnt in den nächsten 15 min). Nur dann darf Hero-Code wechseln.
  let nowPrecip = 0;
  for (let i = 0; i < m.time.length && used < 4; i++) {
    const ts = new Date(m.time[i]).getTime();
    if (ts + 15 * 60 * 1000 < nowMs) continue;
    if (ts > nowMs + 60 * 60 * 1000) break;
    const p = Math.max(0, m.precipitation[i] ?? 0);
    nextPrecip += p;
    if (used === 0) {
      nowPrecip = p;
      firstFutureCode = m.weather_code?.[i];
    }
    used++;
    minutesCovered += 15;
  }

  const ctx = readConvectiveContext(data);
  // mm/h rate über das beobachtete Fenster — für Hourly-Overlay.
  const ratePerHour = minutesCovered > 0 ? (nextPrecip / minutesCovered) * 60 : 0;
  // mm/h des AKTUELLEN Slots — entscheidet, ob der Hero auf Regen schalten darf.
  const nowRatePerHour = nowPrecip * 4;

  // Station sagt trocken (Bodenmessung) → kein Hero-Override durch Modell-Nowcast.
  const cur = data.current as CurrentWithSource;
  const stationDryNow =
    cur._source === "station" &&
    (cur.precipitation_10min == null || cur.precipitation_10min < 0.05);

  let next = data;
  // Hero nur ändern, wenn JETZT Regen fällt oder direkt Gewitter aktiv ist
  // (und Station nicht explizit trocken meldet).
  if (!stationDryNow && (nowPrecip >= 0.15 || ctx.lightning)) {
    next = applyEvidenceToCurrent(next, nowRatePerHour, ctx, firstFutureCode);
  }
  // Hourly-Overlay darf weiterhin künftige Spitze verwenden.
  if (nextPrecip >= 0.2 || ctx.lightning) {
    next = overlayPrecipOnHourly(next, ratePerHour, ctx, firstFutureCode);
  }
  return next;
}

/**
 * Apply Rainbow.ai radar nowcast evidence (mm/h × duration) for the next
 * 60 minutes. Uses the **peak** rate (not just sum) so a 75 mm/h cell
 * 35 minutes away still triggers a "starker Regen" hero label.
 */
export function applyRainbowEvidence(
  data: WeatherData,
  items: Array<{ precipRate: number; precipType: string; timestampBegin: number; timestampEnd: number }> | null | undefined,
): WeatherData {
  if (!Array.isArray(items) || items.length === 0) return data;
  const nowSec = Date.now() / 1000;
  const horizonSec = nowSec + 60 * 60;

  let mmNext60 = 0;
  let peakRate = 0;
  let currentlyRaining = false;
  let currentRate = 0;
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
    mmNext60 += rate * durH;
    if (rate > peakRate) peakRate = rate;
    if (it.timestampBegin <= nowSec && it.timestampEnd > nowSec) {
      currentlyRaining = true;
      currentRate = Math.max(currentRate, rate);
    }
  }

  if (!currentlyRaining && mmNext60 < 0.2 && peakRate < 1) return data;

  const ctx = readConvectiveContext(data);
  const cur = data.current as CurrentWithSource;
  // Station-Bodenmessung trocken → Hero NICHT auf Regen schalten,
  // selbst wenn Radar in den nächsten 60 min eine Zelle zeigt.
  const stationDryNow =
    cur._source === "station" &&
    (cur.precipitation_10min == null || cur.precipitation_10min < 0.05);

  let next = data;
  // Hero-Code nur überschreiben, wenn JETZT Niederschlag fällt
  // (Radarzelle aktiv über dem Standort) und Station das nicht widerlegt.
  if (currentlyRaining && !stationDryNow) {
    const effRate = Math.max(currentRate, peakRate * 0.7);
    next = applyEvidenceToCurrent(next, effRate, ctx, undefined);
  }
  // Hourly-Overlay (kommt-bald-Anzeige) darf weiterhin die Spitze nutzen.
  next = overlayPrecipOnHourly(next, peakRate, ctx, undefined);
  // Niederschlagskachel bekommt die 60-min-Summe — auch ohne Hero-Wechsel,
  // damit „kommende 2h" stimmen, ohne den Ist-Zustand falsch zu malen.
  const cur2 = next.current as CurrentWithSource;
  next = {
    ...next,
    current: {
      ...cur2,
      precipitation: Math.max(cur2.precipitation ?? 0, mmNext60),
      _diagnostics: { ...cur2._diagnostics, rainbowApplied: true },
    },
  };
  return next;
}

function applyEvidenceToCurrent(
  data: WeatherData,
  ratePerHour: number,
  ctx: { convective: boolean; lightning: boolean; severeLightning: boolean },
  evidenceCode: number | undefined,
): WeatherData {
  const current = data.current as CurrentWithSource;
  const code = current.weather_code;
  if (THUNDER_CODE(code)) return data;

  // Compute desired code from rate + convective context
  let desired = wmoCodeForPrecipRate(ratePerHour, ctx);
  // If model already gives a more severe precip code, keep the worse one
  if (evidenceCode != null && (PRECIP_CODE(evidenceCode) || THUNDER_CODE(evidenceCode))) {
    if (severity(evidenceCode) > severity(desired)) desired = evidenceCode;
  }
  // Lightning evidence overrides any precip code
  if (ctx.lightning && !THUNDER_CODE(desired)) {
    desired = wmoCodeForPrecipRate(ratePerHour, { lightning: true, severeLightning: ctx.severeLightning });
  }
  if (desired === -1) return data;
  // Never downgrade a worse model code
  if (severity(desired) < severity(code)) desired = code;

  return {
    ...data,
    current: {
      ...current,
      weather_code: desired,
      precipitation: Math.max(current.precipitation ?? 0, ratePerHour),
      _diagnostics: { ...current._diagnostics, nowcastApplied: true },
    },
  };
}

function overlayPrecipOnHourly(
  data: WeatherData,
  peakRate: number,
  ctx: { convective: boolean; lightning: boolean; severeLightning: boolean },
  evidenceCode: number | undefined,
): WeatherData {
  const h = data.hourly;
  if (!h?.time?.length) return data;
  const nowMs = Date.now();
  let idx = -1;
  for (let i = 0; i < h.time.length; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts + 60 * 60 * 1000 > nowMs) { idx = i; break; }
  }
  if (idx < 0) return data;
  const precip = [...(h.precipitation ?? [])];
  const codes = [...h.weather_code];
  const projHourMm = Math.min(120, peakRate);
  if (precip[idx] != null) precip[idx] = Math.max(precip[idx] ?? 0, projHourMm);
  const c = codes[idx];
  if (!THUNDER_CODE(c)) {
    let desired = wmoCodeForPrecipRate(peakRate, ctx);
    if (evidenceCode != null && severity(evidenceCode) > severity(desired)) desired = evidenceCode;
    if (ctx.lightning) desired = wmoCodeForPrecipRate(peakRate, { lightning: true, severeLightning: ctx.severeLightning });
    if (desired !== -1 && severity(desired) > severity(c)) codes[idx] = desired;
  }
  return { ...data, hourly: { ...h, precipitation: precip, weather_code: codes } };
}

/** Ordinal severity for comparing WMO codes (higher = worse). */
function severity(code: number): number {
  if (code === 99) return 100;
  if (code === 96) return 95;
  if (code === 95) return 90;
  if (code === 82) return 80;
  if (code === 81) return 75;
  if (code === 65) return 72;
  if (code === 80) return 70;
  if (code === 63) return 60;
  if (code === 61) return 50;
  if (code === 51 || code === 53 || code === 55) return 30;
  if (code === 56 || code === 57) return 35;
  if (code === 71 || code === 73 || code === 75 || code === 85 || code === 86 || code === 77) return 55;
  if (code === 66 || code === 67) return 65;
  if (code === 45 || code === 48) return 20;
  if (code === 3) return 10;
  if (code === 2) return 5;
  if (code === 1) return 2;
  if (code === 0) return 0;
  return code; // fallback
}

/**
 * Apply official (DWD / MeteoAlarm) warnings as an override on the Hero
 * weather code. If an active warning says "Gewitter"/"Starkregen" but our
 * code still shows fair weather, escalate so Hero, Icon and Background
 * reflect reality.
 */
export function applyOfficialWarningOverride(
  data: WeatherData,
  warnings: OfficialWarning[] | undefined,
): WeatherData {
  if (!Array.isArray(warnings) || warnings.length === 0) return data;
  const now = Date.now();
  const active = warnings.filter((w) => {
    const start = new Date(w.start).getTime();
    const end = new Date(w.end).getTime();
    return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now);
  });
  if (active.length === 0) return data;

  let desired = -1;
  let escalated = false;
  for (const w of active) {
    const lvl = w.level ?? 1;
    const title = `${w.title} ${w.description}`.toLowerCase();
    const isThunder = w.type === "thunderstorm" || /gewitter/.test(title);
    const isHeavyRain = w.type === "rain" || /starkregen|dauerregen|heftig.*regen/.test(title);
    if (isThunder && lvl >= 2) {
      const code = lvl >= 4 ? 99 : lvl >= 3 ? 96 : 95;
      if (severity(code) > severity(desired === -1 ? 0 : desired)) { desired = code; escalated = true; }
    } else if (isHeavyRain && lvl >= 2) {
      const code = lvl >= 3 ? 82 : 65;
      if (severity(code) > severity(desired === -1 ? 0 : desired)) { desired = code; escalated = true; }
    }
  }
  if (!escalated || desired === -1) return data;

  const cur = data.current as CurrentWithSource;
  if (severity(cur.weather_code) >= severity(desired)) return data;
  return {
    ...data,
    current: {
      ...cur,
      weather_code: desired,
      _diagnostics: { ...cur._diagnostics, warningEscalated: true },
    },
  };
}

function derivedFeelsLike(
  t: number | null,
  windKmh: number | null,
  rh: number | null,
): number | null {
  if (t == null) return null;
  if (t <= 10 && windKmh != null && windKmh >= 5) {
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
