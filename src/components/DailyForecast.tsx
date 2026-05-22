import { safeFixed } from "@/lib/safeFormat";
import { useState } from "react";
import { ChevronDown, Sunrise, Sunset, Wind, Navigation, Droplets, CloudRain, Snowflake, Sun, Zap } from "lucide-react";
import type { CurrentWeather, DailyData, HourlyData } from "@/lib/weather";
import { weekdayLabel, windDirectionLabel } from "@/lib/weather";
import { EffectiveWeatherIcon } from "./WeatherIcon";
import { SectionHeader } from "./SectionHeader";
import { dailyThunderRiskFromHourly } from "@/lib/thunderRisk";

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function DayRow({ daily, i, hourly, current }: { daily: DailyData; i: number; hourly?: HourlyData; current?: CurrentWeather }) {
  const [open, setOpen] = useState(false);
  const min = Math.round(daily.temperature_2m_min[i]);
  const max = Math.round(daily.temperature_2m_max[i]);
  const code = daily.weather_code[i];
  const pop = daily.precipitation_probability_max[i] ?? 0;
  const precip = daily.precipitation_sum[i] ?? 0;
  const wind = Math.round(daily.wind_speed_10m_max[i]);
  const dir = daily.wind_direction_10m_dominant[i];
  const thunder = hourly
    ? dailyThunderRiskFromHourly(hourly.time, hourly.cape, hourly.lifted_index, daily.time[i])
    : { risk: 0, label: "Kein", color: "transparent" };
  const showThunder = thunder.risk >= 20;

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:gap-4 sm:px-6"
      >
        <div className="w-20 shrink-0 sm:w-28">
          <div className="font-medium capitalize">{weekdayLabel(daily.time[i], i)}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(daily.time[i]).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
          </div>
        </div>

        <EffectiveWeatherIcon
          code={code}
          precipitation={precip}
          cloudCover={precip > 0 ? 100 : 50}
          cloudCoverLow={i === 0 ? hourly?.cloud_cover_low?.[0] : undefined}
          humidity={i === 0 ? current?.relative_humidity_2m : undefined}
          hour={i === 0 && current?.time ? new Date(current.time).getHours() : undefined}
          isDay={1}
          className="h-8 w-8 shrink-0 text-primary"
        />

        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
            <Droplets className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="tabular-nums">{pop}%</span>
            {precip > 0 && <span className="tabular-nums">· {safeFixed(precip, 1)} mm</span>}
          </div>
          <div className="hidden items-center gap-1 text-muted-foreground md:flex">
            <Wind className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="tabular-nums">{wind} km/h</span>
          </div>
          {showThunder && (
            <div
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: thunder.color }}
              title={`Gewitter-Risiko: ${thunder.label}`}
            >
              <Zap className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Gewitter: {thunder.label}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 font-display tabular-nums">
          <span className="text-muted-foreground">{min}°</span>
          <span className="text-lg">{max}°</span>
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
          <Detail
            icon={Droplets}
            label="Niederschlagswahrsch."
            value={`${pop}%`}
          />
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

export function DailyForecast({ daily, hourly }: { daily: DailyData; hourly?: HourlyData }) {
  return (
    <section>
      <SectionHeader title="7-Tage-Übersicht" subtitle="Tippen für Details" />
      <div className="space-y-2">
        {daily.time.map((_, i) => (
          <DayRow key={i} daily={daily} i={i} hourly={hourly} />
        ))}
      </div>
    </section>
  );
}
