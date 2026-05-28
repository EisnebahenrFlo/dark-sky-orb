import { useMemo } from "react";
import { Droplets, Sunrise, Sunset, Wind, Zap } from "lucide-react";
import type { CurrentWeather, DailyData, HourlyData } from "@/lib/weather";
import { RealisticWeatherIcon } from "@/components/RealisticWeatherIcon";
import { getEffectiveCode } from "@/components/WeatherIcon";
import { computeThunderstormRiskSeries, type ThunderstormRisk } from "@/hooks/useThunderstormRisk";
import { safeFixed } from "@/lib/safeFormat";

const HOURS = 24;

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short" });
}

interface Cell {
  iso: string;
  label: string;
  temp: number;
  pop: number;
  precip: number;
  wind: number;
  uv: number;
  code: number;
  isDay: number;
  isCurrent: boolean;
  thunder: ThunderstormRisk;
  hour: number;
}

interface SunMarker {
  kind: "sunrise" | "sunset";
  iso: string;
  label: string;
}

export function HourlyStrip({
  hourly,
  daily,
  current,
}: {
  hourly: HourlyData;
  daily: DailyData;
  current?: CurrentWeather;
}) {
  const now = current?.time ? new Date(current.time).getTime() : Date.now();
  const risk = useMemo(() => computeThunderstormRiskSeries(hourly), [hourly]);

  const cells: Cell[] = hourly.time.slice(0, HOURS).map((t, i) => {
    const ts = new Date(t).getTime();
    const isCurrent = ts <= now && now < ts + 60 * 60 * 1000;
    const rawCode = hourly.weather_code[i];
    const precip = hourly.precipitation?.[i] ?? 0;
    const cloud = hourly.cloud_cover?.[i] ?? 0;
    const code = getEffectiveCode(
      rawCode,
      precip,
      cloud,
      undefined,
      new Date(t).getHours(),
      hourly.cloud_cover_low?.[i],
      hourly.cloud_cover_mid?.[i],
    );
    return {
      iso: t,
      label: isCurrent ? "Jetzt" : fmtHour(t),
      temp: hourly.temperature_2m[i],
      pop: hourly.precipitation_probability?.[i] ?? 0,
      precip,
      wind: Math.round(hourly.wind_speed_10m?.[i] ?? 0),
      uv: hourly.uv_index?.[i] ?? 0,
      code,
      isDay: hourly.is_day[i],
      isCurrent,
      thunder: risk.hourly[i] ?? { score: 0, level: "none", label: "Kein Risiko", source: "lpi" },
      hour: new Date(t).getHours(),
    };
  });

  // Sun events inside window
  const startMs = cells[0] ? new Date(cells[0].iso).getTime() : 0;
  const endMs = cells.length ? new Date(cells[cells.length - 1].iso).getTime() + 3600_000 : 0;
  const sunMarkers: SunMarker[] = [];
  daily.sunrise.slice(0, 3).forEach((s) => {
    const ms = new Date(s).getTime();
    if (ms >= startMs && ms <= endMs) sunMarkers.push({ kind: "sunrise", iso: s, label: fmtHour(s) });
  });
  daily.sunset.slice(0, 3).forEach((s) => {
    const ms = new Date(s).getTime();
    if (ms >= startMs && ms <= endMs) sunMarkers.push({ kind: "sunset", iso: s, label: fmtHour(s) });
  });

  function findSunBetween(a: string, b: string | undefined): SunMarker | undefined {
    if (!b) return undefined;
    const aMs = new Date(a).getTime();
    const bMs = new Date(b).getTime();
    return sunMarkers.find((m) => {
      const ms = new Date(m.iso).getTime();
      return ms >= aMs && ms < bMs;
    });
  }

  // Day-change headers
  let lastDay = dayKey(cells[0]?.iso ?? "");

  return (
    <div className="glass overflow-hidden rounded-3xl p-3 sm:p-4">
      <div className="-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-stretch gap-1.5">
          {cells.map((c, i) => {
            const curDay = dayKey(c.iso);
            const showDayMarker = i > 0 && curDay !== lastDay;
            if (showDayMarker) lastDay = curDay;
            const sun = findSunBetween(c.iso, cells[i + 1]?.iso);
            const popHigh = c.pop >= 50;
            const popMid = c.pop >= 30;
            const stormHigh = c.thunder.score >= 50;
            const stormMid = c.thunder.score >= 20;
            const isNight = c.isDay === 0;

            return (
              <div key={c.iso} className="flex items-stretch gap-1.5">
                {showDayMarker && (
                  <div className="flex w-7 shrink-0 flex-col items-center justify-center">
                    <div className="h-full w-px bg-border/60" />
                    <span className="my-1 whitespace-nowrap text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {curDay}
                    </span>
                    <div className="h-full w-px bg-border/60" />
                  </div>
                )}

                <div className="relative flex flex-col items-stretch">
                  <div
                    className={[
                      "relative flex w-[68px] flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-colors",
                      c.isCurrent
                        ? "border-primary/50 bg-primary/10 shadow-[0_0_22px_-6px_color-mix(in_oklab,var(--primary)_70%,transparent)]"
                        : isNight
                          ? "border-border/40 bg-muted/10"
                          : "border-border/40 bg-muted/20",
                      stormHigh ? "ring-1 ring-orange-400/60" : "",
                    ].join(" ")}
                  >
                    {/* Storm corner indicator */}
                    {stormMid && (
                      <Zap
                        size={10}
                        strokeWidth={2.5}
                        className={`absolute right-1.5 top-1.5 ${
                          stormHigh ? "text-orange-400" : "text-amber-400"
                        }`}
                        aria-label={`Gewitter ${c.thunder.label}`}
                      />
                    )}

                    <span
                      className={`text-[10px] font-semibold tabular-nums tracking-tight ${
                        c.isCurrent ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {c.label}
                    </span>

                    <RealisticWeatherIcon code={c.code} isDay={(c.isDay ? 1 : 0) as 0 | 1} size={30} />

                    <span
                      className={`font-display text-lg font-semibold leading-none tabular-nums ${
                        c.isCurrent ? "text-foreground" : "text-foreground/95"
                      }`}
                    >
                      {Math.round(c.temp)}°
                    </span>

                    {/* POP pill — visible above 0 with color ramp */}
                    <div
                      className={[
                        "mt-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums leading-none",
                        c.pop > 0
                          ? popHigh
                            ? "bg-primary/25 text-primary"
                            : popMid
                              ? "bg-primary/15 text-primary/90"
                              : "bg-muted/40 text-muted-foreground"
                          : "text-muted-foreground/40",
                      ].join(" ")}
                      title={c.precip > 0 ? `${safeFixed(c.precip, 1)} mm` : undefined}
                    >
                      <Droplets size={8} strokeWidth={2.25} />
                      {c.pop > 0 ? `${c.pop}%` : "—"}
                    </div>

                    {/* Wind */}
                    <div className="inline-flex items-center gap-0.5 text-[9px] tabular-nums text-muted-foreground/80">
                      <Wind size={8} strokeWidth={2} />
                      {c.wind}
                    </div>
                  </div>
                </div>

                {sun && (
                  <div className="flex w-8 shrink-0 flex-col items-center justify-center gap-1">
                    <div className="h-full w-px bg-amber-400/30" />
                    {sun.kind === "sunrise" ? (
                      <Sunrise size={12} strokeWidth={1.75} className="text-amber-400" />
                    ) : (
                      <Sunset size={12} strokeWidth={1.75} className="text-amber-400/90" />
                    )}
                    <span className="whitespace-nowrap text-[9px] font-medium tabular-nums text-amber-400/90">
                      {sun.label}
                    </span>
                    <div className="h-full w-px bg-amber-400/30" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend strip */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Jetzt
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplets size={10} strokeWidth={2} /> Regenwahrsch.
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap size={10} strokeWidth={2} className="text-amber-400" /> Gewitter
          </span>
        </div>
        <span className="uppercase tracking-wider">scroll →</span>
      </div>
    </div>
  );
}
