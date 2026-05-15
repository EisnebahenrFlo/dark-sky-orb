import {
  Sun, Moon, Cloud, CloudSun, CloudMoon, Cloudy, CloudFog,
  CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Snowflake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PRECIP_CODES = new Set([
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
  80, 81, 82, 95, 96, 99,
]);

/**
 * Returns an icon that is consistent with the actual precipitation amount.
 * If the WMO code says "rain" but precipitation is 0, fall back to a
 * cloud icon based on cloud cover so icon and mm-display never disagree.
 */
export function getEffectiveWeatherIcon(
  code: number,
  precipitation: number,
  cloudCover: number,
  isDay: number = 1,
): LucideIcon {
  const day = isDay === 1;
  if ((precipitation ?? 0) <= 0 && PRECIP_CODES.has(code)) {
    if (cloudCover >= 80) return Cloudy;
    if (cloudCover >= 40) return day ? CloudSun : CloudMoon;
    return day ? Sun : Moon;
  }
  return getWeatherIcon(code, isDay);
}

export function EffectiveWeatherIcon({
  code,
  precipitation,
  cloudCover,
  isDay = 1,
  className,
}: {
  code: number;
  precipitation: number;
  cloudCover: number;
  isDay?: number;
  className?: string;
}) {
  const Icon = getEffectiveWeatherIcon(code, precipitation, cloudCover, isDay);
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

export function WeatherIcon({ code, isDay, className }: { code: number; isDay: number; className?: string }) {
  const Icon = getWeatherIcon(code, isDay);
  return <Icon className={className} strokeWidth={1.25} />;
}
