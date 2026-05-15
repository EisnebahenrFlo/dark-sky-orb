/**
 * Single source of truth for weather icon + description.
 *
 * If the WMO weather_code implies precipitation (51-67, 80-82, 95-99) but the
 * actual precipitation amount is ~0, we override the code based on cloud cover
 * so icon AND text never contradict the displayed mm value.
 */
import {
  Sun, Moon, Cloud, CloudSun, CloudMoon, Cloudy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getWeatherIcon } from "@/components/WeatherIcon";
import { wmoDescription } from "@/lib/weather";

export interface WeatherInfo {
  icon: LucideIcon;
  description: string;
  wmoCode: number;
}

function isPrecipCode(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  );
}

/** Returns the effective WMO code after reconciling with actual precipitation. */
export function getEffectiveWeatherCode(
  weatherCode: number,
  precipitation: number,
  cloudCover: number,
): number {
  if (isPrecipCode(weatherCode) && (precipitation ?? 0) < 0.05) {
    if (cloudCover >= 88) return 3; // Bedeckt
    if (cloudCover >= 50) return 2; // Stark bewölkt / teilweise bewölkt
    if (cloudCover >= 20) return 1; // Wolkig / überwiegend klar
    return 0; // Klar
  }
  return weatherCode;
}

export function getEffectiveWeather(
  weatherCode: number,
  precipitation: number,
  cloudCover: number,
  isDay: number | boolean = 1,
): WeatherInfo {
  const dayNum = typeof isDay === "boolean" ? (isDay ? 1 : 0) : isDay;
  const day = dayNum === 1;

  if (isPrecipCode(weatherCode) && (precipitation ?? 0) < 0.05) {
    if (cloudCover >= 88) {
      return { icon: Cloud, description: "Bedeckt", wmoCode: 3 };
    }
    if (cloudCover >= 50) {
      return {
        icon: day ? CloudSun : CloudMoon,
        description: "Stark bewölkt",
        wmoCode: 2,
      };
    }
    if (cloudCover >= 20) {
      return {
        icon: day ? CloudSun : CloudMoon,
        description: "Wolkig",
        wmoCode: 1,
      };
    }
    return { icon: day ? Sun : Moon, description: "Klar", wmoCode: 0 };
  }

  return {
    icon: getWeatherIcon(weatherCode, dayNum),
    description: wmoDescription(weatherCode),
    wmoCode: weatherCode,
  };
}
