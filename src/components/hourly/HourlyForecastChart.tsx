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
  diffWarm: number | null;
  diffCold: number | null;
  pop: number;
  precip: number;
  wind: number;
  gust: number;
  gustBand: number;
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

function Legend({ items }: { items: Array<{ kind: "dot" | "dash" | "bar"; color: string; label: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-1 px-1 pb-1 text-xs opacity-60">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {it.kind === "dot" && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: it.color }} />}
          {it.kind === "bar" && <span className="inline-block h-2 w-1.5 rounded-sm" style={{ background: it.color }} />}
          {it.kind === "dash" && (
            <span
              className="inline-block h-0 w-3"
              style={{ borderTop: `1.5px dashed ${it.color}` }}
            />
          )}
          <span>{it.label}</span>
        </span>
      ))}
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
    const delta = feels - temp;
    const wind = Math.round(hourly.wind_speed_10m[i] ?? 0);
    const gust = Math.round(hourly.wind_gusts_10m?.[i] ?? wind);
    rows.push({
      time: fmtHour(t),
      iso: t,
      temp,
      feels,
      diffWarm: delta > 3 ? delta : null,
      diffCold: delta < -3 ? delta : null,
      pop: Math.round(hourly.precipitation_probability?.[i] ?? 0),
      precip: hourly.precipitation?.[i] ?? 0,
      wind,
      gust,
      gustBand: Math.max(0, gust - wind),
      uv: hourly.uv_index?.[i] ?? 0,
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

  const accent = "var(--accent)";
  const muted = "var(--muted-foreground)";
  const grid = "oklch(1 0 0 / 0.04)";
  const sep = "oklch(1 0 0 / 0.08)";

  const hiddenX = <XAxis dataKey="time" hide tickLine={false} axisLine={false} />;

  return (
    <div className="glass overflow-hidden rounded-3xl">
      {/* Panel 1: Temp & Gefühlt */}
      <div className="px-3 pt-3">
        <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Temperatur & Gefühlt
        </div>
        <Legend items={[
          { kind: "dot", color: "var(--accent)", label: "Temperatur" },
          { kind: "dash", color: "var(--accent)", label: "Gefühlt" },
        ]} />
        <div className="h-[120px] w-full pt-2 pb-1 sm:h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {hiddenX}
              <YAxis
                width={Y_WIDTH}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                unit="°"
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip content={<UnifiedTooltip />} cursor={{ stroke: "oklch(1 0 0 / 0.15)" }} />
              <Area type="monotone" dataKey="diffCold" stroke="none" fill="#3B82F6" fillOpacity={0.18} isAnimationActive={false} connectNulls={false} baseValue={0} activeDot={false} />
              <Area type="monotone" dataKey="diffWarm" stroke="none" fill="#EF4444" fillOpacity={0.18} isAnimationActive={false} connectNulls={false} baseValue={0} activeDot={false} />
              <Area type="monotone" dataKey="temp" stroke={accent} strokeOpacity={0.6} strokeWidth={2} fill={accent} fillOpacity={0.08} dot={false} activeDot={{ r: 3 }} />
              <Line type="monotone" dataKey="feels" stroke={accent} strokeOpacity={0.4} strokeDasharray="3 3" strokeWidth={1.5} dot={false} activeDot={false} />
              {nowLabel && <ReferenceLine x={nowLabel} stroke={accent} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.8} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: sep }} />

      {/* Panel 2: Niederschlag */}
      <div className="px-3 pt-2">
        <div className="px-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Niederschlag
        </div>
        <Legend items={[
          { kind: "bar", color: "#60A5FA", label: "Regenwahrsch. %" },
          { kind: "bar", color: "#1D4ED8", label: "Regen mm" },
        ]} />
        <div className="h-[100px] w-full pt-2 pb-1 sm:h-[130px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {hiddenX}
              <YAxis
                yAxisId="pop"
                width={Y_WIDTH}
                domain={[0, 100]}
                ticks={[0, 100]}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <YAxis yAxisId="mm" orientation="right" hide domain={[0, (max: number) => Math.max(max, 2)]} />
              <Tooltip content={<UnifiedTooltip />} cursor={{ fill: "oklch(1 0 0 / 0.04)" }} />
              <Bar yAxisId="pop" dataKey="pop" radius={[3, 3, 0, 0]} fill="#60A5FA" fillOpacity={0.7} isAnimationActive={false} />
              <Bar yAxisId="mm" dataKey="precip" radius={[3, 3, 0, 0]} fill="#1D4ED8" fillOpacity={0.85} isAnimationActive={false} />
              {nowLabel && <ReferenceLine yAxisId="pop" x={nowLabel} stroke={accent} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.8} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: sep }} />

      {/* Panel 3: Wind & Böen */}
      <div className="px-3 pt-2">
        <div className="px-1 pb-1 text-[11px] font-medium text-foreground/90">Wind & Böen</div>
        <Legend items={[
          { kind: "dot", color: "var(--accent)", label: "Windgeschw." },
          { kind: "dash", color: "var(--accent)", label: "Böen" },
        ]} />
        <div className="h-[120px] w-full pt-2 pb-1 sm:h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={MARGIN}>
              <CartesianGrid stroke={grid} vertical={false} />
              {hiddenX}
              <YAxis
                width={Y_WIDTH}
                tick={{ fill: muted, fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                domain={[0, (max: number) => Math.max(max, 30)]}
                allowDecimals={false}
              />
              <Tooltip content={<UnifiedTooltip />} cursor={{ stroke: "oklch(1 0 0 / 0.15)" }} />
              <Area type="monotone" dataKey="wind" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} activeDot={false} />
              <Area type="monotone" dataKey="gustBand" stackId="band" stroke="none" fill={accent} fillOpacity={0.06} isAnimationActive={false} activeDot={false} />
              <ReferenceLine y={20} stroke={muted} strokeDasharray="2 3" strokeOpacity={0.4} label={{ value: "leichte Brise", position: "insideTopRight", fill: muted, fontSize: 8 }} />
              <ReferenceLine y={50} stroke={muted} strokeDasharray="2 3" strokeOpacity={0.4} label={{ value: "starker Wind", position: "insideTopRight", fill: muted, fontSize: 8 }} />
              <Line type="monotone" dataKey="gust" stroke={accent} strokeOpacity={0.6} strokeDasharray="4 3" strokeWidth={1} dot={false} activeDot={false} />
              <Line type="monotone" dataKey="wind" stroke={accent} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              {nowLabel && <ReferenceLine x={nowLabel} stroke={accent} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.8} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 1, background: sep }} />

      {/* Panel 4: UV-Index */}
      <div className="px-3 pb-3 pt-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <div className="text-[11px] font-medium text-foreground/90">UV-Index</div>
          {uvPeak > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900 dark:text-orange-300">
              Peak: {uvPeak.toFixed(1)}
            </span>
          )}
        </div>
        <Legend items={[
          { kind: "dot", color: "#22C55E", label: "Gering" },
          { kind: "dot", color: "#EAB308", label: "Mittel" },
          { kind: "dot", color: "#F97316", label: "Hoch" },
          { kind: "dot", color: "#EF4444", label: "Sehr hoch" },
          { kind: "dot", color: "#A855F7", label: "Extrem" },
        ]} />
        <div className="h-[110px] w-full pt-2 pb-1 sm:h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ ...MARGIN, top: 18, bottom: 4 }}>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis
                dataKey="time"
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const isNow = payload.value === nowLabel;
                  if (isNow) {
                    return (
                      <text x={x} y={y + 10} textAnchor="middle" fill={accent} fontSize={10} fontWeight={700}>
                        Jetzt
                      </text>
                    );
                  }
                  return (
                    <text x={x} y={y + 10} textAnchor="middle" fill={muted} fontSize={10}>
                      {payload.value}
                    </text>
                  );
                }}
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
              {nowLabel && <ReferenceLine x={nowLabel} stroke={accent} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.8} />}
              {sunrise && (
                <ReferenceLine x={sunrise.at} stroke={muted} strokeDasharray="2 3" strokeOpacity={0.5}
                  label={{ value: `↑ ${sunrise.label}`, position: "top", fill: muted, fontSize: 9 }} />
              )}
              {sunset && (
                <ReferenceLine x={sunset.at} stroke={muted} strokeDasharray="2 3" strokeOpacity={0.5}
                  label={{ value: `↓ ${sunset.label}`, position: "top", fill: muted, fontSize: 9 }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
