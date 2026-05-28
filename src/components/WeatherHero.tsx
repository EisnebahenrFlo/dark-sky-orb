import type { ReactNode } from "react";
import { safeFixed } from "@/lib/safeFormat";
import { Wind, Droplets, Gauge, CloudRain, Thermometer, Cloud, Navigation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CurrentWeather, GeoResult, MinutelyData } from "@/lib/weather";
import { windDirectionLabel } from "@/lib/weather";
import { getEffectiveWeather } from "@/lib/weatherDescription";
import { summarizeNowcastPrecip } from "@/lib/nowcast";
import { useRainbowNowcast } from "@/hooks/useRainbowNowcast";
import { formatClockTime } from "@/lib/rainbowNowcast";
import { RelativeTime } from "./RelativeTime";
import { WeatherHeroCanvas, getWeatherGroup, getHeroPalette } from "./WeatherHeroCanvas";
import { RealisticWeatherIcon } from "./RealisticWeatherIcon";
import { RefreshButton } from "./RefreshButton";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  location: GeoResult;
  data: CurrentWeather;
  updatedAt: number;
  onRefresh?: () => Promise<void> | void;
  ensemble?: { models: string[]; spreadTemp?: number; spreadPop?: number };
}

/**
 * Kompakte Stat-Kachel mit dezenter Hintergrundgrafik.
 * Wert dominant, Label klein, Icon als großes, transparentes Wasserzeichen.
 */
function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <Icon
        className="pointer-events-none absolute -right-3 -bottom-3 h-20 w-20 opacity-[0.07]"
        strokeWidth={1.25}
        style={accent ? { color: accent } : undefined}
        aria-hidden
      />
      <div className="relative">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <Icon className="h-3 w-3" strokeWidth={1.75} style={accent ? { color: accent } : undefined} />
          {label}
        </div>
        <div className="font-display text-2xl font-semibold tabular-nums leading-none">{value}</div>
        {sub && <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function WeatherHero({ location, data, updatedAt, onRefresh, ensemble }: Props) {
  const effective = getEffectiveWeather(
    data.weather_code,
    data.precipitation,
    data.cloud_cover,
    data.is_day,
    data.relative_humidity_2m,
    new Date(data.time).getHours(),
  );
  const group = getWeatherGroup(data.weather_code, (data.is_day ? 1 : 0) as 0 | 1);
  const palette = getHeroPalette(group);

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 sm:p-10"
      style={{
        background: palette.background,
        color: palette.text,
        transition: "background 1s ease, color 0.6s ease",
        minHeight: 280,
      }}
    >
      <WeatherHeroCanvas weatherCode={data.weather_code} isDay={(data.is_day ? 1 : 0) as 0 | 1} />
      {onRefresh && <RefreshButton variant="hero" onRefresh={onRefresh} />}
      <div style={{ position: "relative", zIndex: 10 }}>
        {/* Ort-Zeile: dezent, klein */}
        <div className="flex items-baseline gap-2">
          <h1
            className="font-display text-lg font-medium leading-none sm:text-xl"
            style={{ color: palette.text }}
          >
            {location.name}
          </h1>
          <span
            className="truncate text-[10px] uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: palette.subtext }}
          >
            {[location.admin1, location.country].filter(Boolean).join(" · ")}
          </span>
        </div>

        {/* Hero-Hauptzeile: Temperatur dominiert, Icon dezent rechts */}
        <div className="mt-4 flex items-start justify-between gap-4 sm:mt-6">
          <div className="min-w-0 flex-1">
            <div
              className="font-display font-extralight leading-[0.85] tabular-nums"
              style={{
                color: palette.text,
                fontSize: "clamp(5.5rem, 22vw, 10rem)",
                letterSpacing: "-0.04em",
              }}
            >
              {Math.round(data.temperature_2m)}°
            </div>
            <div
              className="mt-3 text-base font-medium sm:text-lg"
              style={{ color: palette.text }}
            >
              {effective.description}
            </div>
            <div className="text-xs sm:text-sm" style={{ color: palette.subtext }}>
              Gefühlt {Math.round(data.apparent_temperature)}°
            </div>
          </div>
          <div
            className="shrink-0 self-start"
            style={{ filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.22))" }}
          >
            <RealisticWeatherIcon
              code={data.weather_code}
              isDay={(data.is_day ? 1 : 0) as 0 | 1}
              size={88}
            />
          </div>
        </div>

        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs"
          style={{ color: palette.subtext }}
        >
          <RelativeTime timestamp={updatedAt} />
          <div className="flex items-center gap-2">
            {data._confidence != null && (
              <ConfidenceBadge
                score={data._confidence}
                models={ensemble?.models}
                spreadTemp={ensemble?.spreadTemp}
                spreadPop={ensemble?.spreadPop}
                size="sm"
              />
            )}
            <span className="truncate text-right opacity-80" title={
              data._station
                ? `Messstation ${data._station.name} · ${data._station.distanceKm} km · vor ${data._station.ageMin} Min · Quelle: ${data._station.source === "brightsky" ? "DWD Bright Sky" : "METAR"}`
                : "Modell-Ensemble (Open-Meteo)"
            }>
              {data._station
                ? `📡 ${data._station.name} · ${data._station.distanceKm} km`
                : "Modell-Ensemble"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


export function WeatherHeroStats({
  data,
  minutely15,
  children,
}: {
  data: CurrentWeather;
  minutely15?: MinutelyData;
  children?: ReactNode;
}) {
  const nowcast = summarizeNowcastPrecip(minutely15, 8);
  const rainbow = useRainbowNowcast();

  // Prefer Rainbow.ai nowcast (matches the Nowcast tab) when available.
  let precipValue: string;
  let precipSub: string;
  const rainbowItems = rainbow.data?.forecast;
  if (rainbowItems && rainbowItems.length > 0) {
    const nowSec = Date.now() / 1000;
    const horizonSec = nowSec + 2 * 3600;
    let sumMm = 0;
    let firstStart: { ts: number; type: string } | null = null;
    let currentlyRaining = false;
    let currentType: string = "rain";
    for (const it of rainbowItems) {
      if (typeof it.timestampBegin !== "number") continue;
      if (it.timestampBegin >= horizonSec) continue;
      if (it.timestampEnd <= nowSec - 60) continue;
      const rate = Number.isFinite(it.precipRate) ? Math.max(0, it.precipRate) : 0;
      const durH = Math.max(0, (it.timestampEnd - it.timestampBegin) / 3600);
      if (rate > 0 && it.precipType && it.precipType !== "none" && it.precipType !== "no_precipitation") {
        sumMm += rate * durH;
        if (!firstStart) firstStart = { ts: it.timestampBegin, type: it.precipType };
        if (it.timestampBegin <= nowSec && it.timestampEnd > nowSec) {
          currentlyRaining = true;
          currentType = it.precipType;
        }
      }
    }
    const typeLabel = (t: string) => (t === "snow" ? "Schnee" : t === "ice" ? "Eis" : "Regen");
    if (currentlyRaining) {
      precipValue = `${safeFixed(sumMm, 1)} mm`;
      precipSub = `${typeLabel(currentType)} · nächste 2h`;
    } else if (firstStart && firstStart.ts > nowSec) {
      precipValue = `${typeLabel(firstStart.type)} ab ${formatClockTime(firstStart.ts)}`;
      precipSub = `Spitze ${safeFixed(sumMm, 1)} mm · nächste 2h`;
    } else {
      precipValue = "Kein Regen";
      precipSub = "nächste 2h";
    }
  } else if (nowcast.hasData) {
    precipValue = nowcast.sum < 0.1 ? "Kein Regen" : `${safeFixed(nowcast.sum, 1)} mm`;
    precipSub = "nächste 2h";
  } else {
    precipValue = data.precipitation < 0.1 ? "—" : `${safeFixed(data.precipitation, 1)} mm`;
    precipSub = "aktuelle Stunde";
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Stat
        icon={Wind}
        label="Wind"
        value={`${Math.round(data.wind_speed_10m)} km/h`}
        sub={`${windDirectionLabel(data.wind_direction_10m)} · Böen ${Math.round(data.wind_gusts_10m)}`}
        accent="#38bdf8"
      />
      <div className="glass relative overflow-hidden rounded-2xl p-4">
        {/* Windrose im Hintergrund */}
        <svg
          className="pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.10]"
          viewBox="0 0 100 100"
          aria-hidden
        >
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="0.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="50"
              y1="50"
              x2={50 + 42 * Math.cos(((deg - 90) * Math.PI) / 180)}
              y2={50 + 42 * Math.sin(((deg - 90) * Math.PI) / 180)}
              stroke="currentColor"
              strokeWidth={deg % 90 === 0 ? 1 : 0.4}
            />
          ))}
        </svg>
        <div className="relative">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            <Navigation className="h-3 w-3" strokeWidth={1.75} /> Richtung
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/40"
              style={{ transform: `rotate(${data.wind_direction_10m}deg)` }}
            >
              <Navigation className="h-4 w-4 text-primary" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display text-2xl font-semibold leading-none tabular-nums">
                {Math.round(data.wind_direction_10m)}°
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {windDirectionLabel(data.wind_direction_10m)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Stat icon={CloudRain} label="Niederschlag" value={precipValue} sub={precipSub} accent="#60a5fa" />
      <Stat icon={Cloud} label="Bewölkung" value={`${data.cloud_cover}%`} accent="#94a3b8" />
      <Stat icon={Droplets} label="Luftfeuchte" value={`${data.relative_humidity_2m}%`} accent="#06b6d4" />
      <Stat icon={Gauge} label="Luftdruck" value={`${Math.round(data.pressure_msl)} hPa`} accent="#a78bfa" />
      <Stat icon={Thermometer} label="Gefühlt" value={`${Math.round(data.apparent_temperature)}°`} accent="#fb923c" />
      {children}
    </div>
  );
}
