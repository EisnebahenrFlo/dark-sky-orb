import React from "react";
import {
  ComposedChart,
  BarChart,
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
import { Thermometer, CloudRain, Wind as WindIcon, Sun } from "lucide-react";
import type { HourlyData, DailyData } from "@/lib/weather";

const HOURS = 24;

type Metric = "temp" | "precip" | "wind" | "uv";

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
  pop: number;
  precip: number;
  wind: number;
  gust: number;
  gustBand: number;
  uv: number;
  code: number;
  isDay: number;
}

const Y_WIDTH = 38;
const MARGIN = { top: 8, right: 12, left: 4, bottom: 4 };

function TooltipBox({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Row | undefined;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-medium tabular-nums text-foreground">{label}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        {metric === "temp" && (
          <>
            <span className="text-muted-foreground">Temp</span>
            <span className="text-foreground">{p.temp}°</span>
            <span className="text-muted-foreground">Gefühlt</span>
            <span className="text-foreground">{p.feels}°</span>
          </>
        )}
        {metric === "precip" && (
          <>
            <span className="text-muted-foreground">Wahrsch.</span>
            <span className="text-foreground">{p.pop}%</span>
            <span className="text-muted-foreground">Menge</span>
            <span className="text-foreground">{p.precip.toFixed(1)} mm</span>
          </>
        )}
        {metric === "wind" && (
          <>
            <span className="text-muted-foreground">Wind</span>
            <span className="text-foreground">{p.wind} km/h</span>
            <span className="text-muted-foreground">Böen</span>
            <span className="text-foreground">{p.gust} km/h</span>
          </>
        )}
        {metric === "uv" && (
          <>
            <span className="text-muted-foreground">UV-Index</span>
            <span className="text-foreground">{p.uv.toFixed(1)}</span>
          </>
        )}
      </div>
    </div>
  );
}

function Legend({ items }: { items: Array<{ kind: "dot" | "dash" | "bar"; color: string; label: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {it.kind === "dot" && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: it.color }} />}
          {it.kind === "bar" && <span className="inline-block h-2.5 w-1.5 rounded-sm" style={{ background: it.color }} />}
          {it.kind === "dash" && (
            <span className="inline-block h-0 w-3.5" style={{ borderTop: `1.5px dashed ${it.color}` }} />
          )}
          <span>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

const METRICS: Array<{ id: Metric; label: string; short: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [
  { id: "temp",   label: "Temperatur", short: "Temp",   icon: Thermometer, color: "#F97316" },
  { id: "precip", label: "Niederschlag", short: "Regen", icon: CloudRain,   color: "#3B82F6" },
  { id: "wind",   label: "Wind & Böen", short: "Wind",  icon: WindIcon,    color: "#0EA5E9" },
  { id: "uv",     label: "UV-Index",   short: "UV",    icon: Sun,         color: "#EAB308" },
];

export function HourlyForecastChart({
  hourly,
  daily,
  currentTime,
}: {
  hourly: HourlyData;
  daily?: DailyData;
  currentTime?: string;
}) {
  const [metric, setMetric] = React.useState<Metric>("temp");

  // Find starting index = current hour (or closest)
  const now = currentTime ? new Date(currentTime).getTime() : Date.now();
  let startIdx = 0;
  let bestStart = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const d = Math.abs(new Date(hourly.time[i]).getTime() - now);
    if (d < bestStart) { bestStart = d; startIdx = i; }
  }
  const endIdx = Math.min(startIdx + HOURS, hourly.time.length);

  const rows: Row[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const t = hourly.time[i];
    const temp = Math.round(hourly.temperature_2m[i]);
    const feels = Math.round(hourly.apparent_temperature?.[i] ?? hourly.temperature_2m[i]);
    const wind = Math.round(hourly.wind_speed_10m[i] ?? 0);
    const gust = Math.round(hourly.wind_gusts_10m?.[i] ?? wind);
    rows.push({
      time: fmtHour(t),
      iso: t,
      temp,
      feels,
      pop: Math.round(hourly.precipitation_probability?.[i] ?? 0),
      precip: hourly.precipitation?.[i] ?? 0,
      wind,
      gust,
      gustBand: Math.max(0, gust - wind),
      uv: hourly.uv_index?.[i] ?? 0,
      code: hourly.weather_code?.[i] ?? 0,
      isDay: hourly.is_day?.[i] ?? 1,
    });
  }

  const nowLabel = rows[0]?.time;

  // Sunrise/sunset within the window
  const startMs = rows[0] ? new Date(rows[0].iso).getTime() : 0;
  const endMs = rows[rows.length - 1] ? new Date(rows[rows.length - 1].iso).getTime() : 0;
  function pickEvent(times?: string[]): { at: string; label: string } | undefined {
    if (!times) return undefined;
    for (const ts of times) {
      const ms = new Date(ts).getTime();
      if (ms >= startMs && ms <= endMs) {
        const label = new Date(ts).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        let best: string | undefined;
        let bd = Infinity;
        for (const r of rows) {
          const d = Math.abs(new Date(r.iso).getTime() - ms);
          if (d < bd) { bd = d; best = r.time; }
        }
        if (best) return { at: best, label };
      }
    }
    return undefined;
  }
  const sunrise = pickEvent(daily?.sunrise);
  const sunset = pickEvent(daily?.sunset);

  const uvPeak = rows.reduce((m, r) => (r.uv > m ? r.uv : m), 0);

  // Theme-aware colors (works in light & dark via oklch tokens)
  const muted = "var(--muted-foreground)";
  const grid = "color-mix(in oklab, var(--foreground) 10%, transparent)";
  const axis = "color-mix(in oklab, var(--foreground) 55%, transparent)";

  // Custom X-axis tick: hides if collides with "Jetzt"
  const renderXTick = (props: any) => {
    const { x, y, payload, index } = props;
    if (payload.value === nowLabel) {
      return (
        <text x={x} y={y + 12} textAnchor="middle" fill="var(--primary)" fontSize={10} fontWeight={700}>
          Jetzt
        </text>
      );
    }
    // Show every 4th hour
    if (index % 4 !== 0) return <g />;
    return (
      <text x={x} y={y + 12} textAnchor="middle" fill={axis} fontSize={10}>
        {payload.value}
      </text>
    );
  };

  const sharedX = (
    <XAxis
      dataKey="time"
      tick={renderXTick}
      tickLine={false}
      axisLine={false}
      interval={0}
      height={22}
    />
  );

  const sharedRefs = (
    <>
      {nowLabel && (
        <ReferenceLine x={nowLabel} stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.7} />
      )}
      {sunrise && (
        <ReferenceLine
          x={sunrise.at}
          stroke={muted}
          strokeDasharray="2 3"
          strokeOpacity={0.45}
          label={{ value: `☀ ${sunrise.label}`, position: "insideTopRight", fill: muted, fontSize: 9 }}
        />
      )}
      {sunset && (
        <ReferenceLine
          x={sunset.at}
          stroke={muted}
          strokeDasharray="2 3"
          strokeOpacity={0.45}
          label={{ value: `☾ ${sunset.label}`, position: "insideTopRight", fill: muted, fontSize: 9 }}
        />
      )}
    </>
  );

  const cursor = { stroke: "var(--primary)", strokeOpacity: 0.35, strokeWidth: 1 };

  return (
    <div className="glass overflow-hidden rounded-3xl">
      {/* Header: title + metric tabs */}
      <div className="space-y-2.5 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tagesverlauf · nächste 24 h
          </div>
          {metric === "uv" && uvPeak > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
              Peak {uvPeak.toFixed(1)}
            </span>
          )}
        </div>

        {/* Metric tabs */}
        <div
          role="tablist"
          aria-label="Messwert auswählen"
          className="flex w-full gap-1 rounded-xl border border-border/40 bg-muted/40 p-1"
        >
          {METRICS.map((m) => {
            const active = metric === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={active}
                onClick={() => setMetric(m.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend per metric */}
      <div className="px-4 pb-1">
        {metric === "temp" && (
          <Legend
            items={[
              { kind: "dot", color: "#F97316", label: "Temperatur" },
              { kind: "dash", color: "#F97316", label: "Gefühlt" },
            ]}
          />
        )}
        {metric === "precip" && (
          <Legend
            items={[
              { kind: "bar", color: "#1D4ED8", label: "Niederschlag mm" },
              { kind: "dot", color: "#60A5FA", label: "Wahrscheinlichkeit %" },
            ]}
          />
        )}
        {metric === "wind" && (
          <Legend
            items={[
              { kind: "dot", color: "#0EA5E9", label: "Wind" },
              { kind: "dash", color: "#0EA5E9", label: "Böen" },
            ]}
          />
        )}
        {metric === "uv" && (
          <Legend
            items={[
              { kind: "bar", color: "#22C55E", label: "Gering" },
              { kind: "bar", color: "#EAB308", label: "Mittel" },
              { kind: "bar", color: "#F97316", label: "Hoch" },
              { kind: "bar", color: "#EF4444", label: "Sehr hoch" },
              { kind: "bar", color: "#A855F7", label: "Extrem" },
            ]}
          />
        )}
      </div>

      {/* Chart */}
      <div className="h-[260px] w-full px-2 pb-3 pt-1 sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {metric === "temp" ? (
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {sharedX}
              <YAxis
                width={Y_WIDTH}
                tick={{ fill: axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                unit="°"
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip content={<TooltipBox metric={metric} />} cursor={cursor} />
              <defs>
                <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="temp"
                stroke="#F97316"
                strokeWidth={2.25}
                fill="url(#tempFill)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#F97316" }}
              />
              <Line
                type="monotone"
                dataKey="feels"
                stroke="#F97316"
                strokeOpacity={0.75}
                strokeDasharray="4 3"
                strokeWidth={1.75}
                dot={false}
                activeDot={false}
              />
              {sharedRefs}
            </ComposedChart>
          ) : metric === "precip" ? (
            (() => {
              const maxMm = Math.max(
                ...rows.map((r) => (Number.isFinite(r.precip) ? r.precip : 0)),
                0,
              );
              const mmDomainMax = maxMm > 0 ? Math.max(Math.ceil(maxMm * 1.2 * 10) / 10, 1) : 2;
              return (
                <ComposedChart data={rows} margin={MARGIN}>
                  <CartesianGrid stroke={grid} vertical={false} />
                  {sharedX}
                  {/* Left axis: precipitation amount (mm) — primary */}
                  <YAxis
                    yAxisId="mm"
                    width={Y_WIDTH}
                    domain={[0, mmDomainMax]}
                    tick={{ fill: axis, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    unit=" mm"
                    allowDecimals
                  />
                  {/* Right axis: probability — for the overlay line */}
                  <YAxis
                    yAxisId="pop"
                    orientation="right"
                    domain={[0, 100]}
                    width={26}
                    ticks={[0, 50, 100]}
                    tick={{ fill: axis, fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <Tooltip content={<TooltipBox metric={metric} />} cursor={cursor} />
                  <defs>
                    <linearGradient id="popFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {/* Probability as soft area background */}
                  <Area
                    yAxisId="pop"
                    type="monotone"
                    dataKey="pop"
                    stroke="#60A5FA"
                    strokeWidth={1.5}
                    strokeOpacity={0.8}
                    fill="url(#popFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Precipitation amount as solid bars (primary visual) */}
                  <Bar
                    yAxisId="mm"
                    dataKey="precip"
                    radius={[3, 3, 0, 0]}
                    fill="#1D4ED8"
                    fillOpacity={0.9}
                    minPointSize={3}
                    isAnimationActive={false}
                  />
                  {sharedRefs}
                </ComposedChart>
              );
            })()
          ) : metric === "wind" ? (
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {sharedX}
              <YAxis
                width={Y_WIDTH}
                tick={{ fill: axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                domain={[0, (max: number) => Math.max(max, 30)]}
                allowDecimals={false}
                unit=""
              />
              <Tooltip content={<TooltipBox metric={metric} />} cursor={cursor} />
              <defs>
                <linearGradient id="windFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="wind" stackId="band" stroke="none" fill="transparent" />
              <Area type="monotone" dataKey="gustBand" stackId="band" stroke="none" fill="#0EA5E9" fillOpacity={0.12} />
              <ReferenceLine y={20} stroke={muted} strokeDasharray="2 3" strokeOpacity={0.35} />
              <ReferenceLine y={50} stroke={muted} strokeDasharray="2 3" strokeOpacity={0.35} />
              <Line
                type="monotone"
                dataKey="gust"
                stroke="#0EA5E9"
                strokeOpacity={0.75}
                strokeDasharray="4 3"
                strokeWidth={1.75}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="wind"
                stroke="#0EA5E9"
                strokeWidth={2.25}
                fill="url(#windFill)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#0EA5E9" }}
              />
              {sharedRefs}
            </ComposedChart>
          ) : (
            <BarChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {sharedX}
              <YAxis
                width={Y_WIDTH}
                domain={[0, 12]}
                ticks={[0, 3, 6, 9, 12]}
                tick={{ fill: axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<TooltipBox metric={metric} />} cursor={cursor} />
              <Bar dataKey="uv" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.uv > 0 ? uvColor(r.uv) : "transparent"} />
                ))}
              </Bar>
              {sharedRefs}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
