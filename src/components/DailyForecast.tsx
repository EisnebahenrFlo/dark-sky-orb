import { safeFixed } from "@/lib/safeFormat";
import { useState } from "react";
import { ChevronDown, Sunrise, Sunset, Wind, Navigation, Droplets, CloudRain, Snowflake, Sun, Zap } from "lucide-react";
import type { CurrentWeather, DailyData, HourlyData } from "@/lib/weather";
import { weekdayLabel, windDirectionLabel } from "@/lib/weather";
import { RealisticWeatherIcon } from "./RealisticWeatherIcon";
import { SectionHeader } from "./SectionHeader";
import { dailyThunderRiskFromHourly } from "@/lib/thunderRisk";

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function DayRow({ daily, i, hourly, current }: { daily: DailyData; i: number; hourly?: HourlyData; current?: CurrentWeather }) {
  const [open, setOpen] = useState(false);
  const min = daily.temperature_2m_min[i] != null ? Math.round(daily.temperature_2m_min[i]) : null;
  const max = daily.temperature_2m_max[i] != null ? Math.round(daily.temperature_2m_max[i]) : null;
  const code = daily.weather_code[i];
  const pop = daily.precipitation_probability_max[i] ?? 0;
  const precip = daily.precipitation_sum[i] ?? 0;
  
  const wind = daily.wind_speed_10m_max[i] != null ? Math.round(daily.wind_speed_10m_max[i]) : null;
  const dir = daily.wind_direction_10m_dominant[i];
  const thunder = hourly
    ? dailyThunderRiskFromHourly(hourly.time, hourly.cape, hourly.lifted_index, daily.time[i])
    : { risk: 0, label: "Kein", color: "transparent" };
  

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

        <RealisticWeatherIcon
          code={code}
          isDay={1}
          size={28}
          className="shrink-0"
        />
        {void iconPrecip}

        {/* Indicators column: rain % + thunder level */}
        <div className="flex w-[52px] shrink-0 flex-col items-end gap-px leading-tight">
          {pop > 20 && (
            <span
              className="text-[9.5px] tabular-nums"
              style={{
                fontWeight: pop > 70 ? 700 : 600,
                color: pop > 70 ? "#1d4ed8" : "#3b82f6",
              }}
            >
              {pop}%
            </span>
          )}
          {thunder.risk >= 20 && (
            <div
              className="flex items-center gap-[2px] text-[8.5px] font-semibold"
              style={{ color: thunder.risk >= 60 ? "#b45309" : "#d97706" }}
              title={`Gewitter-Risiko: ${thunder.label}`}
            >
              <Zap size={9} strokeWidth={2} />
              <span>{thunder.risk >= 60 ? "Unwetter" : "Gew. mögl."}</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
            <Droplets className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="tabular-nums">{pop}%</span>
            {precip > 0 && <span className="tabular-nums">· {safeFixed(precip, 1)} mm</span>}
          </div>
          <div className="hidden items-center gap-1 text-muted-foreground md:flex">
            <Wind className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="tabular-nums">{wind != null ? `${wind} km/h` : "—"}</span>
          </div>
        </div>

        <div className="flex items-baseline gap-3 font-display tabular-nums">
          <span className="text-[12px] font-normal text-[#a0b0c0] dark:text-slate-500">{min != null ? `${min}°` : "—"}</span>
          <span className="text-[14px] font-bold text-[#1a2a3a] dark:text-white">{max != null ? `${max}°` : "—"}</span>
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

export function DailyForecast({ daily, hourly, current }: { daily: DailyData; hourly?: HourlyData; current?: CurrentWeather }) {
  return (
    <section>
      <SectionHeader title="7-Tage-Übersicht" subtitle="Tippen für Details" />
      <div className="space-y-2">
        {daily.time.map((_, i) => (
          <DayRow key={i} daily={daily} i={i} hourly={hourly} current={current} />
        ))}
      </div>
    </section>
  );
}
