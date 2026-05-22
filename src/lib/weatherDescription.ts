import type { LucideIcon } from "lucide-react";
import { getEffectiveCode, getWeatherIcon } from "@/components/WeatherIcon";
import { getContextualDescription } from "@/lib/weather";

export interface WeatherInfo {
  icon: LucideIcon;
  description: string;
  wmoCode: number;
}

/**
 * Single source of truth for weather icon + description.
 * If the WMO code implies precipitation but actual precipitation is ~0,
 * both icon and description fall back to a cloud-cover-based label so they
 * never contradict the displayed mm value.
 */
export function getEffectiveWeather(
  weatherCode: number,
  precipitation: number,
  cloudCover: number,
  isDay: number | boolean = 1,
  humidity?: number,
  hour?: number,
  cloudCoverLow?: number,
): WeatherInfo {
  const dayNum = typeof isDay === "boolean" ? (isDay ? 1 : 0) : isDay;
  const effective = getEffectiveCode(weatherCode, precipitation, cloudCover, humidity, hour, cloudCoverLow);
  return {
    icon: getWeatherIcon(effective, dayNum),
    description: wmoDescription(effective),
    wmoCode: effective,
  };
}

export { getEffectiveCode };
