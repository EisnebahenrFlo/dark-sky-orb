import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { Droplets, Wind } from "lucide-react";
import type { HourlyData } from "@/lib/weather";
import { formatTime } from "@/lib/weather";
import { beaufortBadge } from "@/lib/bft";
import { EffectiveWeatherIcon } from "./WeatherIcon";
import { SectionHeader } from "./SectionHeader";

const THUNDER_CODES = new Set([95, 96, 99]);

export function HourlyForecast({ hourly }: { hourly: HourlyData }) {
  const rows = hourly.time.map((t, i) => ({
    time: formatTime(t),
    temp: Math.round(hourly.temperature_2m[i]),
    pop: hourly.precipitation_probability[i] ?? 0,
    precip: hourly.precipitation[i] ?? 0,
    wind: Math.round(hourly.wind_speed_10m[i]),
    gust: Math.round(hourly.wind_gusts_10m?.[i] ?? 0),
    code: hourly.weather_code[i],
    isDay: hourly.is_day[i],
    cloud: hourly.cloud_cover?.[i] ?? 0,
    cloudLow: hourly.cloud_cover_low?.[i],
    cloudMid: hourly.cloud_cover_mid?.[i],
    isThunder: THUNDER_CODES.has(hourly.weather_code[i]),
  }));

  return (
    <section>
      <SectionHeader title="Stündlich" subtitle="Nächste 24 Stunden" />
      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="-mx-2 overflow-x-auto pb-2">
          <div className="flex gap-2 px-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border px-2 py-3 ${
                  r.isThunder
                    ? "border-yellow-400/50 bg-yellow-400/[0.06]"
                    : "border-border/50 bg-white/[0.02]"
                }`}
              >
                <div className="text-[11px] tabular-nums text-muted-foreground">{r.time}</div>
                <EffectiveWeatherIcon code={r.code} precipitation={r.precip} cloudCover={r.cloud} cloudCoverLow={r.cloudLow} cloudCoverMid={r.cloudMid} isDay={r.isDay} className="my-2 h-6 w-6 text-primary" />
                <div className="font-display text-base tabular-nums">{r.temp}°</div>
                <div className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Droplets className="h-2.5 w-2.5" strokeWidth={1.5} />
                  {r.pop}%
                </div>
                <div
                  className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground"
                  title={beaufortBadge(r.wind)}
                >
                  <Wind className="h-2.5 w-2.5" strokeWidth={1.5} />
                  {r.wind}
                  {r.gust >= r.wind + 10 && (
                    <span className="ml-0.5 text-amber-400/80">·{r.gust}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.04)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={2}
              />
              <YAxis
                yAxisId="temp"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={44}
                unit="°"
              />
              <YAxis
                yAxisId="pop"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={40}
                unit="%"
              />
              <Tooltip
                cursor={{ stroke: "oklch(1 0 0 / 0.1)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar
                yAxisId="pop"
                dataKey="pop"
                fill="oklch(0.78 0.16 230 / 0.25)"
                radius={[4, 4, 0, 0]}
                name="Regen-Wahrsch."
                unit="%"
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temp"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                name="Temperatur"
                unit="°"
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="gust"
                stroke="oklch(0.78 0.14 50 / 0.7)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                name="Böen"
                unit=" km/h"
              />
              {rows.map((r, i) =>
                r.isThunder ? (
                  <ReferenceDot
                    key={`thunder-${i}`}
                    yAxisId="pop"
                    x={r.time}
                    y={98}
                    r={4}
                    fill="oklch(0.85 0.18 90)"
                    stroke="oklch(0.4 0.1 90)"
                    strokeWidth={1}
                  />
                ) : null,
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-[oklch(0.78_0.14_50_/_0.7)]" />Böen</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-[oklch(0.85_0.18_90)]" />Gewitterstunde</span>
        </div>
      </div>
    </section>
  );
}
