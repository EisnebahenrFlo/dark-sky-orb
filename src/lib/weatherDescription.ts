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
  cloudCoverMid?: number,
): WeatherInfo {
  const dayNum = typeof isDay === "boolean" ? (isDay ? 1 : 0) : isDay;
  const effective = getEffectiveCode(weatherCode, precipitation, cloudCover, humidity, hour, cloudCoverLow, cloudCoverMid);
  // Bei Nacht dürfen "Sonnig"/"Heiter" nicht erscheinen — feste Nachtlabels für klare/bewölkte Codes.
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
