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
  Thermometer,
  CloudSun,
} from "lucide-react";
import type { CurrentWeather, DailyData, HourlyData } from "@/lib/weather";
import { weekdayLabel, windDirectionLabel } from "@/lib/weather";
import { RealisticWeatherIcon } from "./RealisticWeatherIcon";
import { SectionHeader } from "./SectionHeader";
import { computeThunderstormRiskSeries } from "@/hooks/useThunderstormRisk";

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function popColor(pop: number) {
  if (pop >= 70) return "text-primary";
  if (pop >= 40) return "text-primary/85";
  if (pop >= 20) return "text-foreground/80";
  return "text-muted-foreground/70";
}

function uvLabel(uv: number) {
  if (uv >= 11) return { txt: "Extrem", cls: "text-fuchsia-400" };
  if (uv >= 8) return { txt: "Sehr hoch", cls: "text-red-400" };
  if (uv >= 6) return { txt: "Hoch", cls: "text-orange-400" };
  if (uv >= 3) return { txt: "Mittel", cls: "text-amber-400" };
  return { txt: "Gering", cls: "text-emerald-400" };
}

function stormPill(score: number) {
  if (score < 20) return null;
  if (score >= 75) return { cls: "bg-red-500 text-white", label: "Sehr hoch" };
  if (score >= 50) return { cls: "bg-orange-500 text-white", label: "Hoch" };
  return { cls: "bg-amber-400 text-amber-950", label: "Möglich" };
}

function RangeBar({
  min,
  max,
  weekMin,
  weekMax,
  highlight,
}: {
  min: number;
  max: number;
  weekMin: number;
  weekMax: number;
  highlight?: boolean;
}) {
  const span = Math.max(1, weekMax - weekMin);
  const leftPct = ((min - weekMin) / span) * 100;
  const widthPct = ((max - min) / span) * 100;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-foreground/10">
      <div
        className={[
          "absolute h-full rounded-full",
          highlight
            ? "bg-gradient-to-r from-sky-400 via-primary to-orange-400"
            : "bg-gradient-to-r from-sky-500/80 via-primary/90 to-orange-400/90",
        ].join(" ")}
        style={{
          left: `${Math.max(0, leftPct)}%`,
          width: `${Math.max(4, widthPct)}%`,
        }}
      />
    </div>
  );
}

function Chip({
  icon: Icon,
  children,
  tone = "muted",
  title,
}: {
  icon?: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  children: React.ReactNode;
  tone?: "muted" | "primary" | "warn";
  title?: string;
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "warn"
        ? "text-amber-400"
        : "text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${toneCls}`}
      title={title}
    >
      {Icon && <Icon size={12} strokeWidth={1.75} />}
      {children}
    </span>
  );
}

function DayRow({
  daily,
  i,
  thunderScore,
  weekMin,
  weekMax,
  highlights,
}: {
  daily: DailyData;
  i: number;
  hourly?: HourlyData;
  current?: CurrentWeather;
  thunderScore: number;
  weekMin: number;
  weekMax: number;
  highlights: { hottest: number; coldest: number; wettest: number };
}) {
  const [open, setOpen] = useState(false);
  const min = daily.temperature_2m_min[i];
  const max = daily.temperature_2m_max[i];
  const code = daily.weather_code[i];
  const pop = daily.precipitation_probability_max[i] ?? 0;
  const precip = daily.precipitation_sum[i] ?? 0;
  const wind = daily.wind_speed_10m_max[i];
  const dir = daily.wind_direction_10m_dominant[i];
  const uv = daily.uv_index_max[i] ?? 0;
  const storm = stormPill(thunderScore);
  const wet = precip >= 1;

  const isHottest = i === highlights.hottest;
  const isColdest = i === highlights.coldest;
  const isWettest = i === highlights.wettest && precip >= 1;

  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border transition-colors",
        wet
          ? "border-primary/25 bg-primary/[0.04]"
          : "border-border/40 bg-foreground/[0.02]",
      ].join(" ")}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-foreground/[0.03] sm:gap-4 sm:px-4"
      >
        {/* Day + date */}
        <div className="w-20 shrink-0 sm:w-24">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-semibold capitalize leading-tight text-foreground">
              {weekdayLabel(daily.time[i], i)}
            </span>
            {isHottest && (
              <span title="Heißester Tag" className="text-orange-400">
                <Thermometer size={11} strokeWidth={2.25} />
              </span>
            )}
            {isColdest && (
              <span title="Kältester Tag" className="text-sky-400">
                <Snowflake size={11} strokeWidth={2.25} />
              </span>
            )}
            {isWettest && (
              <span title="Regenreichster Tag" className="text-primary">
                <CloudRain size={11} strokeWidth={2.25} />
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {new Date(daily.time[i]).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
          </div>
        </div>

        {/* Weather icon */}
        <RealisticWeatherIcon code={code} isDay={1} size={36} className="shrink-0" />

        {/* Middle: stacked metrics + range bar */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Metrics row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
            <Chip icon={Droplets} tone={pop >= 40 ? "primary" : "muted"} title="Regenwahrscheinlichkeit">
              <span className={popColor(pop)}>{pop > 0 ? `${pop}%` : "—"}</span>
            </Chip>
            {precip > 0 && (
              <Chip icon={CloudRain} tone="muted" title="Niederschlagssumme">
                {safeFixed(precip, 1)} mm
              </Chip>
            )}
            {wind != null && (
              <Chip icon={Wind} tone="muted" title={`${windDirectionLabel(dir)} · ${Math.round(dir)}°`}>
                {Math.round(wind)} km/h
              </Chip>
            )}
            {uv >= 3 && (
              <Chip icon={Sun} tone="muted" title="UV-Index">
                <span className={uvLabel(uv).cls}>UV {Math.round(uv)}</span>
              </Chip>
            )}
            {storm && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${storm.cls}`}
                title={`Gewitter: ${storm.label}`}
              >
                <Zap size={10} strokeWidth={2.5} />
                {storm.label}
              </span>
            )}
          </div>

          {/* Range bar mobile-only (desktop shown right-side) */}
          <div className="flex items-center gap-2 sm:hidden">
            <span className="w-7 text-right text-[11px] tabular-nums text-muted-foreground">
              {min != null ? `${Math.round(min)}°` : "—"}
            </span>
            <RangeBar
              min={min ?? weekMin}
              max={max ?? weekMax}
              weekMin={weekMin}
              weekMax={weekMax}
              highlight={isHottest || isColdest}
            />
            <span className="w-7 text-left font-display text-[13px] font-semibold tabular-nums text-foreground">
              {max != null ? `${Math.round(max)}°` : "—"}
            </span>
          </div>
        </div>

        {/* Desktop: range bar + temps on the right */}
        <div className="hidden items-center gap-2.5 sm:flex">
          <span className="w-7 text-right text-[12px] tabular-nums text-muted-foreground">
            {min != null ? `${Math.round(min)}°` : "—"}
          </span>
          <div className="w-24">
            <RangeBar
              min={min ?? weekMin}
              max={max ?? weekMax}
              weekMin={weekMin}
              weekMax={weekMax}
              highlight={isHottest || isColdest}
            />
          </div>
          <span className="w-8 text-left font-display text-base font-semibold tabular-nums text-foreground">
            {max != null ? `${Math.round(max)}°` : "—"}
          </span>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-border/50 bg-foreground/[0.03] p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
          <Detail icon={Sunrise} label="Sonnenaufgang" value={timeOnly(daily.sunrise[i])} />
          <Detail icon={Sunset} label="Sonnenuntergang" value={timeOnly(daily.sunset[i])} />
          <Detail icon={Sun} label="UV-Index" value={`${Math.round(uv)} · ${uvLabel(uv).txt}`} />
          <Detail icon={Wind} label="Böen" value={`${Math.round(daily.wind_gusts_10m_max[i])} km/h`} />
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
          <Detail icon={Snowflake} label="Schnee" value={`${safeFixed(daily.snowfall_sum[i], 1)} cm`} />
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
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" strokeWidth={1.5} />
        {label}
      </div>
      <div className="font-display text-base tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function HighlightStrip({
  daily,
  highlights,
}: {
  daily: DailyData;
  highlights: { hottest: number; coldest: number; wettest: number };
}) {
  const day = (i: number) =>
    new Date(daily.time[i]).toLocaleDateString("de-DE", { weekday: "short" });
  const hot = daily.temperature_2m_max[highlights.hottest];
  const cold = daily.temperature_2m_min[highlights.coldest];
  const wet = daily.precipitation_sum[highlights.wettest] ?? 0;
  const items: Array<{ icon: typeof Sun; label: string; value: string; tone: string }> = [
    {
      icon: Thermometer,
      label: `Wärmster · ${day(highlights.hottest)}`,
      value: hot != null ? `${Math.round(hot)}°` : "—",
      tone: "text-orange-400",
    },
    {
      icon: CloudSun,
      label: `Kältester · ${day(highlights.coldest)}`,
      value: cold != null ? `${Math.round(cold)}°` : "—",
      tone: "text-sky-400",
    },
  ];
  if (wet >= 1) {
    items.push({
      icon: CloudRain,
      label: `Nass · ${day(highlights.wettest)}`,
      value: `${safeFixed(wet, 1)} mm`,
      tone: "text-primary",
    });
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((it, idx) => (
        <div
          key={idx}
          className="glass flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
        >
          <it.icon className={`h-4 w-4 ${it.tone}`} strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {it.label}
            </div>
            <div className="font-display text-base font-semibold tabular-nums leading-tight">
              {it.value}
            </div>
          </div>
        </div>
      ))}
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

  // Week-wide min/max for range bars and highlights
  const mins = daily.temperature_2m_min.filter((v) => v != null) as number[];
  const maxs = daily.temperature_2m_max.filter((v) => v != null) as number[];
  const weekMin = mins.length ? Math.min(...mins) : 0;
  const weekMax = maxs.length ? Math.max(...maxs) : 1;

  let hottest = 0;
  let coldest = 0;
  let wettest = 0;
  for (let i = 1; i < daily.time.length; i++) {
    if ((daily.temperature_2m_max[i] ?? -Infinity) > (daily.temperature_2m_max[hottest] ?? -Infinity)) hottest = i;
    if ((daily.temperature_2m_min[i] ?? Infinity) < (daily.temperature_2m_min[coldest] ?? Infinity)) coldest = i;
    if ((daily.precipitation_sum[i] ?? 0) > (daily.precipitation_sum[wettest] ?? 0)) wettest = i;
  }
  const highlights = { hottest, coldest, wettest };

  return (
    <section className="space-y-4">
      <SectionHeader title="7-Tage-Übersicht" subtitle="Tippen für Details" />
      <HighlightStrip daily={daily} highlights={highlights} />
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
              weekMin={weekMin}
              weekMax={weekMax}
              highlights={highlights}
            />
          );
        })}
      </div>
    </section>
  );
}
