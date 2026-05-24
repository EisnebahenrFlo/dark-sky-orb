import {
  ComposedChart,
  AreaChart,
  BarChart,
  LineChart,
  Area,
  Bar,
  Line,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { HourlyData, DailyData } from "@/lib/weather";

const HOURS = 24;

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function uvColor(uv: number): string {
  if (uv >= 11) return "#A855F7";
  if (uv >= 8) return "#EF4444";
  if (uv >= 6) return "#F97316";
  if (uv >= 3) return "#EAB308";
  return "#22C55E";
}

interface Row {
  time: string;
  iso: string;
  temp: number;
  feels: number;
  diffWarm: number | null; // feels > temp band
  diffCold: number | null; // feels < temp band
  pop: number;
  precip: number;
  wind: number;
  gust: number;
  gustBand: number; // gust - wind for stacked fill
  uv: number;
}

const Y_WIDTH = 32;
const MARGIN = { top: 6, right: 8, left: 0, bottom: 0 };

function UnifiedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Row | undefined;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur">
      <div className="mb-1 font-medium tabular-nums">{label}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Temp</span>
        <span>{p.temp}° <span className="text-muted-foreground">(gef. {p.feels}°)</span></span>
        <span className="text-muted-foreground">Regen</span>
        <span>{p.pop}% · {p.precip.toFixed(1)} mm</span>
        <span className="text-muted-foreground">Wind</span>
        <span>{p.wind} <span className="text-muted-foreground">/ Böen {p.gust}</span> km/h</span>
        <span className="text-muted-foreground">UV</span>
        <span>{p.uv.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function HourlyForecastChart({
  hourly,
  daily,
  currentTime,
}: {
  hourly: HourlyData;
  daily?: DailyData;
  currentTime?: string;
}) {
  const rows: Row[] = hourly.time.slice(0, HOURS).map((t, i) => {
    const temp = Math.round(hourly.temperature_2m[i]);
    const feels = Math.round(hourly.apparent_temperature?.[i] ?? hourly.temperature_2m[i]);
    const delta = feels - temp;
    const wind = Math.round(hourly.wind_speed_10m[i] ?? 0);
    const gust = Math.round(hourly.wind_gusts_10m?.[i] ?? wind);
    return {
      time: fmtHour(t),
      iso: t,
      temp,
      feels,
      diffWarm: delta > 3 ? delta : null,
      diffCold: delta < -3 ? delta : null,
      pop: hourly.precipitation_probability?.[i] ?? 0,
      precip: hourly.precipitation?.[i] ?? 0,
      wind,
      gust,
      gustBand: Math.max(0, gust - wind),
      uv: hourly.uv_index?.[i] ?? 0,
    };
  });

  // Find current-time tick label (closest hour)
  const now = currentTime ? new Date(currentTime).getTime() : Date.now();
  let nowLabel: string | undefined;
  let bestDiff = Infinity;
  for (const r of rows) {
    const d = Math.abs(new Date(r.iso).getTime() - now);
    if (d < bestDiff) { bestDiff = d; nowLabel = r.time; }
  }

  // Sunrise/sunset labels within the 24h window
  const firstIso = rows[0]?.iso;
  const lastIso = rows[rows.length - 1]?.iso;
  const startMs = firstIso ? new Date(firstIso).getTime() : 0;
  const endMs = lastIso ? new Date(lastIso).getTime() : 0;
  function pickEvent(times?: string[]): string | undefined {
    if (!times) return undefined;
    for (const ts of times) {
      const ms = new Date(ts).getTime();
      if (ms >= startMs && ms <= endMs) {
        const label = new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        // map to the closest row's time label
        let best: string | undefined;
        let bd = Infinity;
        for (const r of rows) {
          const d = Math.abs(new Date(r.iso).getTime() - ms);
          if (d < bd) { bd = d; best = r.time; }
        }
        return best ? `${best}|${label}` : undefined;
      }
    }
    return undefined;
  }
  const sunriseTick = pickEvent(daily?.sunrise);
  const sunsetTick = pickEvent(daily?.sunset);
  const sunriseLabel = sunriseTick?.split("|")[1];
  const sunsetLabel = sunsetTick?.split("|")[1];
  const sunriseAt = sunriseTick?.split("|")[0];
  const sunsetAt = sunsetTick?.split("|")[0];

  const uvPeak = rows.reduce((m, r) => (r.uv > m ? r.uv : m), 0);
  const uvPeakLabel = uvPeak > 0 ? `UV-Peak: ${uvPeak.toFixed(1)}` : null;

  const accent = "var(--accent)";
  const muted = "var(--muted-foreground)";
  const grid = "oklch(1 0 0 / 0.04)";
  const sep = "oklch(1 0 0 / 0.08)";

  const commonX = (
    <XAxis dataKey="time" hide tickLine={false} axisLine={false} />
  );

  return (
    <div className="glass overflow-hidden rounded-3xl">
      {/* Panel 1: Temp & Gefühlt */}
      <div className="px-3 pt-3">
        <div className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Temperatur & Gefühlt
        </div>
        <div className="h-[80px] w-full sm:h-[88px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {commonX}
              <YAxis
                width={Y_WIDTH}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                unit="°"
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip content={<UnifiedTooltip />} cursor={{ stroke: "oklch(1 0 0 / 0.15)" }} />
              {/* Diff bands (between temp and feels) */}
              <Area
                type="monotone"
                dataKey="diffCold"
                stroke="none"
                fill="#3B82F6"
                fillOpacity={0.18}
                isAnimationActive={false}
                connectNulls={false}
                baseValue={0}
                activeDot={false}
              />
              <Area
                type="monotone"
                dataKey="diffWarm"
                stroke="none"
                fill="#EF4444"
                fillOpacity={0.18}
                isAnimationActive={false}
                connectNulls={false}
                baseValue={0}
                activeDot={false}
              />
              <Area
                type="monotone"
                dataKey="temp"
                stroke={accent}
                strokeOpacity={0.6}
                strokeWidth={2}
                fill={accent}
                fillOpacity={0.08}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="feels"
                stroke={accent}
                strokeOpacity={0.4}
                strokeDasharray="3 3"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
              />
              {nowLabel && <ReferenceLine x={nowLabel} stroke={accent} strokeDasharray="2 3" strokeOpacity={0.6} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: sep }} />

      {/* Panel 2: Niederschlag */}
      <div className="px-3 pt-2">
        <div className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Niederschlag
        </div>
        <div className="h-[80px] w-full sm:h-[88px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {commonX}
              <YAxis
                width={Y_WIDTH}
                domain={[0, 100]}
                ticks={[0, 100]}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip content={<UnifiedTooltip />} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
              <Bar dataKey="pop" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {rows.map((r, i) => (
                  <Cell key={i} fill="#3B82F6" fillOpacity={r.precip > 0.1 ? 0.85 : 0.5} />
                ))}
              </Bar>
              {nowLabel && <ReferenceLine x={nowLabel} stroke={accent} strokeDasharray="2 3" strokeOpacity={0.6} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: sep }} />

      {/* Panel 3: Wind & Böen */}
      <div className="px-3 pt-2">
        <div className="px-1 text-[11px] font-medium text-foreground/90">Wind & Böen</div>
        <div className="h-[110px] w-full sm:h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {commonX}
              <YAxis
                width={Y_WIDTH}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                domain={[0, (max: number) => Math.max(max, 30)]}
                allowDecimals={false}
              />
              <Tooltip content={<UnifiedTooltip />} cursor={{ stroke: "oklch(1 0 0 / 0.15)" }} />
              {/* Stacked invisible base + band to show wind→gust spread */}
              <Area
                type="monotone"
                dataKey="wind"
                stackId="band"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                activeDot={false}
              />
              <Area
                type="monotone"
                dataKey="gustBand"
                stackId="band"
                stroke="none"
                fill={accent}
                fillOpacity={0.1}
                isAnimationActive={false}
                activeDot={false}
              />
              <ReferenceLine
                y={20}
                stroke={muted}
                strokeDasharray="2 3"
                strokeOpacity={0.4}
                label={{ value: "leichte Brise", position: "insideTopRight", fill: muted, fontSize: 8 }}
              />
              <ReferenceLine
                y={50}
                stroke={muted}
                strokeDasharray="2 3"
                strokeOpacity={0.4}
                label={{ value: "starker Wind", position: "insideTopRight", fill: muted, fontSize: 8 }}
              />
              <Line
                type="monotone"
                dataKey="gust"
                stroke={accent}
                strokeOpacity={0.6}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="wind"
                stroke={accent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              {nowLabel && <ReferenceLine x={nowLabel} stroke={accent} strokeDasharray="2 3" strokeOpacity={0.6} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: sep }} />

      {/* Panel 4: UV-Index (with bottom X axis) */}
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-baseline justify-between px-1">
          <div className="text-[11px] font-medium text-foreground/90">UV-Index</div>
          {uvPeakLabel && (
            <div className="text-[10px] tabular-nums text-muted-foreground">{uvPeakLabel}</div>
          )}
        </div>
        <div className="h-[120px] w-full sm:h-[132px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ ...MARGIN, bottom: 4 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: muted, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={2}
                minTickGap={12}
              />
              <YAxis
                width={Y_WIDTH}
                domain={[0, 12]}
                ticks={[0, 3, 6, 9, 12]}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<UnifiedTooltip />} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
              <Bar dataKey="uv" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.uv > 0 ? uvColor(r.uv) : "transparent"} />
                ))}
              </Bar>
              {nowLabel && (
                <ReferenceLine x={nowLabel} stroke={accent} strokeDasharray="2 3" strokeOpacity={0.7} />
              )}
              {sunriseAt && sunriseLabel && (
                <ReferenceLine
                  x={sunriseAt}
                  stroke={muted}
                  strokeDasharray="2 3"
                  strokeOpacity={0.5}
                  label={{ value: `↑ ${sunriseLabel}`, position: "top", fill: muted, fontSize: 9 }}
                />
              )}
              {sunsetAt && sunsetLabel && (
                <ReferenceLine
                  x={sunsetAt}
                  stroke={muted}
                  strokeDasharray="2 3"
                  strokeOpacity={0.5}
                  label={{ value: `↓ ${sunsetLabel}`, position: "top", fill: muted, fontSize: 9 }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
