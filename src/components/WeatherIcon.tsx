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

/** Override the WMO code when "rain" is reported but no precipitation falls. */
export function getEffectiveCode(
  code: number,
  precipitation: number,
  cloudCover: number,
  humidity?: number,
  hour?: number,
  cloudCoverLow?: number,
): number {
  const effectiveCloud = cloudCoverLow !== undefined && cloudCoverLow !== null ? cloudCoverLow : cloudCover;
  // Bodennebel-Erkennung früh morgens
  if (code === 45 || code === 48) {
    const h = hour ?? -1;
    const isMorning = h >= 4 && h <= 9;
    const hum = humidity ?? 0;
    if (isMorning && hum >= 85 && effectiveCloud < 50) {
      // Bodennebel der sich auflöst — als Dunst behandeln
      // Code 1 = "Überwiegend klar" mit leichtem Dunst-Charakter
      return effectiveCloud >= 20 ? 1 : 0;
    }
  }
  if (isPrecipCode(code) && (precipitation ?? 0) < 0.05) {
    if (effectiveCloud >= 88) return 3;
    if (effectiveCloud >= 50) return 2;
    if (effectiveCloud >= 20) return 1;
    return 0;
  }
  return code;
}

export function EffectiveWeatherIcon({
  code,
  precipitation,
  cloudCover,
  cloudCoverLow,
  isDay = 1,
  className,
}: {
  code: number;
  precipitation: number;
  cloudCover: number;
  cloudCoverLow?: number;
  isDay?: number;
  className?: string;
}) {
  const effective = getEffectiveCode(code, precipitation, cloudCover, undefined, undefined, cloudCoverLow);
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

export function WeatherIcon({ code, isDay, className }: { code: number; isDay: number; className?: string }) {
  const Icon = getWeatherIcon(code, isDay);
  return <Icon className={className} strokeWidth={1.25} />;
}
