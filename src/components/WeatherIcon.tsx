import {
  Sun, Moon, Cloud, CloudSun, CloudMoon, Cloudy, CloudFog,
  CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Snowflake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function isPrecipCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  );
}

function isThunderstormCode(code: number): boolean {
  return code === 95 || code === 96 || code === 99;
}

/**
 * Optional meteorological context that helps decide whether the model
 * weather_code should be trusted, downgraded or overridden.
 * All fields are optional — when absent the function falls back to the
 * pure cloud-cover heuristic (legacy behaviour).
 */
export interface CodeContext {
  /** CAPE (J/kg) at the current hour. >100 = noteworthy convection. */
  cape?: number;
  /** Lifted Index (°C) — <0 means unstable. */
  liftedIndex?: number;
  /** Open-Meteo lightning_potential (J/kg). >0 = thunder energy present. */
  lightningPotential?: number;
  /** Surface visibility in metres — <5000 supports fog. */
  visibility?: number;
  /** WMO code reported by a nearby ground station (Bright Sky / METAR). */
  stationCode?: number;
  /** 10-minute precip from the ground station (mm). */
  stationPrecip10?: number;
}

/**
 * Map a WMO code to a display-appropriate code using a meteorological
 * priority hierarchy:
 *
 *   1. Observed phenomena from a ground station (fog / thunder / precip type)
 *      override the model when the model disagrees and observation is fresh.
 *   2. Model precipitation codes (incl. 95–99 thunderstorms) are kept unless
 *      ALL supporting signals are absent (CAPE, LPI, current precip, clouds).
 *   3. Otherwise fall back to a cloud-cover heuristic — including the
 *      cirrus-only downgrade for codes 2/3.
 */
export function getEffectiveCode(
  code: number,
  precipitation: number,
  cloudCover: number,
  humidity?: number,
  hour?: number,
  cloudCoverLow?: number,
  cloudCoverMid?: number,
  ctx?: CodeContext,
): number {
  const effectiveCloud =
    cloudCoverLow !== undefined && cloudCoverLow !== null ? cloudCoverLow : cloudCover;
  const precip = precipitation ?? 0;
  const stationPrecip = ctx?.stationPrecip10;
  const stationKnownDry = stationPrecip != null && stationPrecip < 0.05;
  const stationKnownWet = stationPrecip != null && stationPrecip >= 0.05;

  // === Priority 1: trust ground-station phenomenology when it disagrees ===
  if (ctx?.stationCode != null) {
    const sc = ctx.stationCode;
    // Station sees fog → fog wins (model often misses Hochnebel).
    if ((sc === 45 || sc === 48) && code < 45) return sc;
    // Station sees thunderstorm → thunder wins.
    if (sc >= 95 && code < 95) return sc;
    // Station reports precipitation while model says "clear/cloudy" only.
    if (sc >= 51 && sc <= 86 && code < 51 && stationKnownWet) return sc;
  }

  // === Priority 2a: thunderstorm code — only downgrade if EVERYTHING is dead ===
  if (isThunderstormCode(code)) {
    const cape = ctx?.cape ?? 0;
    const li = ctx?.liftedIndex;
    const lpi = ctx?.lightningPotential ?? 0;
    const noConvectiveSignal =
      cape < 100 && (li == null || li > 0) && lpi === 0;
    const noPrecipNow = precip < 0.05 && !stationKnownWet;
    const lowClouds = effectiveCloud < 40;
    if (noConvectiveSignal && noPrecipNow && lowClouds && stationKnownDry !== false) {
      // Plausible: storm passed / never arrived → downgrade to cloud state.
      if (effectiveCloud >= 50) return 2;
      if (effectiveCloud >= 20) return 1;
      return 0;
    }
    return code;
  }

  // === Priority 2b: fog codes — keep unless visibility proves clear air ===
  if (code === 45 || code === 48) {
    const vis = ctx?.visibility;
    if (vis != null && vis > 5000) {
      const h = hour ?? -1;
      const isMorning = h >= 4 && h <= 9;
      const hum = humidity ?? 0;
      if (isMorning && hum >= 85 && effectiveCloud < 50) {
        return effectiveCloud >= 20 ? 1 : 0;
      }
      if (effectiveCloud >= 88) return 3;
      if (effectiveCloud >= 50) return 2;
      return 1;
    }
    return code;
  }

  // === Priority 2c: precip codes without observed precip ===
  if (isPrecipCode(code) && precip < 0.05) {
    // Station explicitly wet → never downgrade.
    if (stationKnownWet) return code;
    if (effectiveCloud >= 88) return 3;
    if (effectiveCloud >= 50) return 2;
    if (effectiveCloud >= 20) return 1;
    return 0;
  }

  // === Priority 3: cirrus-only downgrade for "cloudy"/"overcast" codes ===
  if ((code === 2 || code === 3) && cloudCoverLow !== undefined && cloudCoverLow !== null) {
    const lowMid = cloudCoverLow + 0.5 * (cloudCoverMid ?? 0);
    if (lowMid < 12) return 0;
    if (lowMid < 30) return 1;
    if (lowMid < 60) return 2;
    return 3;
  }
  return code;
}

export function EffectiveWeatherIcon({
  code,
  precipitation,
  cloudCover,
  cloudCoverLow,
  cloudCoverMid,
  humidity,
  hour,
  isDay = 1,
  className,
  ctx,
}: {
  code: number;
  precipitation: number;
  cloudCover: number;
  cloudCoverLow?: number;
  cloudCoverMid?: number;
  humidity?: number;
  hour?: number;
  isDay?: number;
  className?: string;
  ctx?: CodeContext;
}) {
  const effective = getEffectiveCode(code, precipitation, cloudCover, humidity, hour, cloudCoverLow, cloudCoverMid, ctx);
  const Icon = getWeatherIcon(effective, isDay);
  return <Icon className={className} strokeWidth={1.25} />;
}

export function getWeatherIcon(code: number, isDay: number): LucideIcon {
  const day = isDay === 1;
  if (code === 0) return day ? Sun : Moon;
  if (code === 1) return day ? CloudSun : CloudMoon;
  if (code === 2) return day ? CloudSun : CloudMoon;
  if (code === 3) return Cloudy;
  if (code === 45 || code === 48) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 85, 86].includes(code)) return CloudSnow;
  if (code === 77) return Snowflake;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

// Realistic gradient SVG weather icon. See ./RealisticWeatherIcon for the implementation.
export { RealisticWeatherIcon as WeatherIcon } from "./RealisticWeatherIcon";
