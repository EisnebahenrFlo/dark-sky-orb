import type { LucideIcon } from "lucide-react";
import { getEffectiveCode, getWeatherIcon, type CodeContext } from "@/components/WeatherIcon";
import { getContextualDescription } from "@/lib/weather";

export interface WeatherInfo {
  icon: LucideIcon;
  description: string;
  wmoCode: number;
}

/**
 * Single source of truth for weather icon + description.
 * Uses the meteorological priority hierarchy in `getEffectiveCode` so
 * thunderstorm/fog/precipitation codes are not falsely downgraded when
 * other signals (CAPE, LPI, station obs, visibility) support them.
 */
export function getEffectiveWeather(
  weatherCode: number,
  precipitation: number,
  cloudCover: number,
  isDay: number | boolean = 1,
  humidity?: number,
  hour?: number,
  cloudCoverLow?: number,
  cloudCoverMid?: number,
  ctx?: CodeContext,
): WeatherInfo {
  const dayNum = typeof isDay === "boolean" ? (isDay ? 1 : 0) : isDay;
  const effective = getEffectiveCode(weatherCode, precipitation, cloudCover, humidity, hour, cloudCoverLow, cloudCoverMid, ctx);
  const nightLabels: Record<number, string> = {
    0: "Klar",
    1: "Überwiegend klar",
    2: "Teilweise bewölkt",
    3: "Bedeckt",
  };
  const description =
    dayNum === 0 && effective in nightLabels
      ? nightLabels[effective]
      : getContextualDescription(effective, hour, humidity, cloudCoverLow);
  return {
    icon: getWeatherIcon(effective, dayNum),
    description,
    wmoCode: effective,
  };
}

export { getEffectiveCode };
export type { CodeContext };
