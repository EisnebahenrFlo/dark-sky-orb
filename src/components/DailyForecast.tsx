import { safeFixed } from "@/lib/safeFormat";
import { useState } from "react";
import {
  ChevronDown,
  Sunrise,
  Sunset,
  Wind,
  Navigation,
  Droplets,
  CloudRain,
  Snowflake,
  Sun,
  Zap,
} from "lucide-react";
import type { CurrentWeather, DailyData, HourlyData } from "@/lib/weather";
import { weekdayLabel, windDirectionLabel } from "@/lib/weather";
import { RealisticWeatherIcon } from "./RealisticWeatherIcon";
import { SectionHeader } from "./SectionHeader";
import { computeThunderstormRiskSeries } from "@/hooks/useThunderstormRisk";

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function ThunderBadge({ score }: { score: number }) {
  if (score < 20) return null;
  const { cls, label } =
    score >= 75
      ? { cls: "bg-red-500 text-white", label: "Sehr hoch" }
      : score >= 50
      ? { cls: "bg-orange-500 text-white", label: "Hoch" }
      : { cls: "bg-amber-400 text-amber-950", label: "Möglich" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ${cls}`}
      title={`Gewitter: ${label}`}
    >
      <Zap size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
}

function DayRow({
  daily,
  i,
  hourly,
  thunderScore,
}: {
  daily: DailyData;
  i: number;
  hourly?: HourlyData;
  current?: CurrentWeather;
  thunderScore: number;
}) {
  const [open, setOpen] = useState(false);
  const min = daily.temperature_2m_min[i] != null ? Math.round(daily.temperature_2m_min[i]) : null;
  const max = daily.temperature_2m_max[i] != null ? Math.round(daily.temperature_2m_max[i]) : null;
  const code = daily.weather_code[i];
  const pop = daily.precipitation_probability_max[i] ?? 0;
  const precip = daily.precipitation_sum[i] ?? 0;
  const wind = daily.wind_speed_10m_max[i] != null ? Math.round(daily.wind_speed_10m_max[i]) : null;
  const dir = daily.wind_direction_10m_dominant[i];



  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-6"
      >
        {/* Day + date */}
        <div className="w-24 shrink-0 sm:w-28">
          <div className="text-[15px] font-semibold capitalize leading-tight text-foreground">
            {weekdayLabel(daily.time[i], i)}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {new Date(daily.time[i]).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
          </div>
        </div>

        {/* Weather icon */}
        <RealisticWeatherIcon code={code} isDay={1} size={28} className="shrink-0" />

        {/* Middle: precipitation + wind + thunder */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px]">
          {pop > 0 && (
            <span
              className="tabular-nums font-medium"
              style={{ color: pop > 70 ? "#1d4ed8" : "#3b82f6" }}
            >
              {pop}%
            </span>
          )}
          {precip > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
              <Droplets className="h-3.5 w-3.5" strokeWidth={1.75} />
              {safeFixed(precip, 1)} mm
            </span>
          )}
          {wind != null && (
            <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
              <Navigation
                className="h-3.5 w-3.5"
                strokeWidth={1.75}
                style={{ transform: `rotate(${dir + 180}deg)` }}
              />
              {wind} km/h
            </span>
          )}
          <ThunderBadge score={thunderScore} />
        </div>

        {/* Temps */}
        <div className="flex items-baseline gap-3 font-display tabular-nums">
          <span className="text-[14px] text-muted-foreground">{min != null ? `${min}°` : "—"}</span>
          <span className="text-[17px] font-bold text-foreground">
            {max != null ? `${max}°` : "—"}
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-border/50 bg-black/20 p-4 sm:grid-cols-3 sm:p-6 lg:grid-cols-4">
          <Detail icon={Sunrise} label="Sonnenaufgang" value={timeOnly(daily.sunrise[i])} />
          <Detail icon={Sunset} label="Sonnenuntergang" value={timeOnly(daily.sunset[i])} />
          <Detail icon={Sun} label="UV-Index" value={String(Math.round(daily.uv_index_max[i] ?? 0))} />
          <Detail
            icon={Wind}
            label="Böen"
            value={`${Math.round(daily.wind_gusts_10m_max[i])} km/h`}
          />
          <Detail
            icon={Navigation}
            label="Windrichtung"
            value={`${windDirectionLabel(dir)} · ${Math.round(dir)}°`}
          />
          <Detail
            icon={CloudRain}
            label="Regen"
            value={`${safeFixed(daily.rain_sum[i], 1)} mm`}
            sub={`${daily.precipitation_hours[i] ?? 0} h Niederschlag`}
          />
          <Detail
            icon={Snowflake}
            label="Schnee"
            value={`${safeFixed(daily.snowfall_sum[i], 1)} cm`}
          />
          <Detail icon={Droplets} label="Niederschlagswahrsch." value={`${pop}%`} />
        </div>
      )}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Sunrise;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {label}
      </div>
      <div className="font-display text-base tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DailyForecast({
  daily,
  hourly,
  current,
}: {
  daily: DailyData;
  hourly?: HourlyData;
  current?: CurrentWeather;
}) {
  const riskSeries = hourly ? computeThunderstormRiskSeries(hourly) : null;
  return (
    <section>
      <SectionHeader title="7-Tage-Übersicht" subtitle="Tippen für Details" />
      <div className="space-y-2">
        {daily.time.map((dateIso, i) => {
          const score = riskSeries?.byDay[dateIso.slice(0, 10)]?.score ?? 0;
          return (
            <DayRow
              key={i}
              daily={daily}
              i={i}
              hourly={hourly}
              current={current}
              thunderScore={score}
            />
          );
        })}
      </div>
    </section>
  );
}
