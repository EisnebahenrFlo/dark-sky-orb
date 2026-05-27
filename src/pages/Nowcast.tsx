import { useState } from "react";
import { Info, Radio, CloudSun, TrendingUp } from "lucide-react";
import type { HourlyData } from "@/lib/weather";
import { Nowcast } from "@/components/Nowcast";
import { PageState } from "@/components/PageState";
import { useWeather } from "@/contexts/WeatherContext";
import {
  useRainbowNowcast,
  type RainbowNowcastResponse,
} from "@/hooks/useRainbowNowcast";
import {
  buildMarkers,
  buildPoints,
  buildSegments,
  buildSummary,
  computeRateCeiling,
  findPeak,
  formatOffset,
  formatRate,
  intensityLabel,
  type NowcastSegment,
  type PrecipKind,
} from "@/lib/rainbowNowcast";

type Range = 8 | 24;

const TYPE_COLORS: Record<PrecipKind, { fill: string; stroke: string }> = {
  rain: { fill: "#B5D4F4", stroke: "#378ADD" },
  snow: { fill: "#CECBF6", stroke: "#7F77DD" },
  ice: { fill: "#F4C0D1", stroke: "#D4537E" },
  none: { fill: "transparent", stroke: "var(--color-border-tertiary, var(--border))" },
};

const TYPE_LABEL: Record<PrecipKind, string> = {
  rain: "Regen",
  snow: "Schnee",
  ice: "Eis",
  none: "Kein Niederschlag",
};

const TYPE_EMOJI: Record<PrecipKind, string> = {
  rain: "🌧",
  snow: "❄️",
  ice: "🧊",
  none: "",
};

const VB_W = 600;
const VB_H = 100;
const Y_AXIS_PAD = 32; // reserved for y-axis labels inside viewBox

function areaPath(seg: NowcastSegment): string {
  if (seg.points.length === 0) return "";
  const pts = seg.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const top = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  return `${top} L ${last.x.toFixed(2)} ${VB_H} L ${first.x.toFixed(2)} ${VB_H} Z`;
}

function linePath(seg: NowcastSegment): string {
  if (seg.points.length === 0) return "";
  return seg.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

function timeTicks(minutes: number): number[] {
  if (minutes <= 120) return [0, 30, 60, 90, 120];
  return [0, 60, 120, 180, 240, 300, 360];
}

function RainbowChart({ data, minutes }: { data: RainbowNowcastResponse; minutes: number }) {
  const nowSec = Date.now() / 1000;
  // First pass: discover peak with default ceiling to derive a true-data ceiling.
  const probe = buildPoints(data.forecast ?? [], nowSec, minutes, VB_W, VB_H, 100);
  const ceiling = computeRateCeiling(probe);
  const points = buildPoints(data.forecast ?? [], nowSec, minutes, VB_W, VB_H, ceiling);
  const segments = buildSegments(points);
  const markers = buildMarkers(points, minutes, VB_W);
  const summary = buildSummary(points, minutes);
  const peak = findPeak(points);
  const ticks = timeTicks(minutes);

  const presentTypes = Array.from(
    new Set(points.filter((p) => p.type !== "none" && p.rate > 0).map((p) => p.type)),
  ) as PrecipKind[];

  const noPrecip = points.length === 0 || presentTypes.length === 0;

  // Y-axis scale labels: 0, mid, top
  const yLabels = [ceiling, ceiling / 2, 0];

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div
          className={`text-sm ${summary.warn ? "font-medium text-orange-500" : "font-medium text-foreground"}`}
        >
          {summary.text}
        </div>
        {peak && (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
            <TrendingUp className="h-3 w-3 text-primary" strokeWidth={2} />
            Spitze {formatRate(peak.rate)} · {intensityLabel(peak.rate)}
          </div>
        )}
      </div>

      {presentTypes.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {presentTypes.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${TYPE_COLORS[t].fill}80`, color: TYPE_COLORS[t].stroke }}
            >
              {TYPE_EMOJI[t]} {TYPE_LABEL[t]}
            </span>
          ))}
        </div>
      )}

      <div className="relative w-full overflow-hidden">
        {noPrecip ? (
          <div className="grid h-44 place-items-center text-center text-muted-foreground">
            <div>
              <CloudSun className="mx-auto h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
              <div className="mt-2 text-sm">Kein Niederschlag erwartet</div>
            </div>
          </div>
        ) : (
          <svg
            viewBox={`-${Y_AXIS_PAD} 0 ${VB_W + Y_AXIS_PAD} ${VB_H + 16}`}
            preserveAspectRatio="none"
            width="100%"
            height="auto"
            className="block h-44 w-full max-w-full"
            aria-label="Niederschlagsverlauf"
          >
            {/* Horizontal gridlines + Y-axis labels */}
            {yLabels.map((val, i) => {
              const y = (i / (yLabels.length - 1)) * VB_H;
              return (
                <g key={i}>
                  <line
                    x1={0}
                    y1={y}
                    x2={VB_W}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={i === yLabels.length - 1 ? 0.35 : 0.12}
                    strokeWidth={i === yLabels.length - 1 ? 1.2 : 1}
                    strokeDasharray={i === yLabels.length - 1 ? "" : "3 4"}
                    className="text-border"
                  />
                  <text
                    x={-6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={9}
                    className="fill-muted-foreground tabular-nums"
                  >
                    {val < 1 ? val.toFixed(1).replace(".", ",") : Math.round(val)}
                  </text>
                </g>
              );
            })}
            {/* Unit label */}
            <text x={-6} y={-2} textAnchor="end" fontSize={8} className="fill-muted-foreground">
              mm/h
            </text>

            {/* "Jetzt" dashed vertical */}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={VB_H}
              stroke="currentColor"
              strokeOpacity={0.5}
              strokeWidth={0.8}
              strokeDasharray="2 3"
              className="text-muted-foreground"
            />

            {/* Segments */}
            {segments.map((seg, i) => {
              const c = TYPE_COLORS[seg.type];
              if (seg.type === "none") {
                return (
                  <path
                    key={i}
                    d={linePath(seg)}
                    fill="none"
                    stroke={c.stroke}
                    strokeWidth={1}
                    strokeLinecap="round"
                  />
                );
              }
              return (
                <g key={i}>
                  <path d={areaPath(seg)} fill={c.fill} fillOpacity={0.55} stroke="none" />
                  <path
                    d={linePath(seg)}
                    fill="none"
                    stroke={c.stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Peak marker */}
            {peak && (
              <g>
                <circle cx={peak.x ?? 0} cy={peak.y ?? 0} r={3.5} fill="var(--background)" stroke={TYPE_COLORS[peak.type].stroke} strokeWidth={2} />
              </g>
            )}

            {/* Begin / End markers */}
            {markers.map((m, i) => (
              <g key={i}>
                <line
                  x1={m.x}
                  y1={0}
                  x2={m.x}
                  y2={VB_H}
                  stroke="currentColor"
                  strokeOpacity={0.45}
                  strokeWidth={0.8}
                  strokeDasharray="2 2"
                  className="text-muted-foreground"
                />
                <text
                  x={m.x + 4}
                  y={11}
                  fontSize={10}
                  fontWeight={600}
                  className="fill-foreground"
                >
                  {m.label}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* Time axis labels */}
        <div className="relative mt-1 h-4 w-full overflow-visible pl-7 pr-2">
          {ticks.map((t, i) => {
            const leftPct = (t / minutes) * 100;
            const isFirst = i === 0;
            const isLast = i === ticks.length - 1;
            return (
              <span
                key={t}
                className={`absolute text-[10px] text-muted-foreground tabular-nums ${
                  isFirst
                    ? "text-left"
                    : isLast
                      ? "-translate-x-full text-right"
                      : "-translate-x-1/2"
                }`}
                style={{ left: `calc(${leftPct}% + ${(1 - leftPct / 100) * 0}px)` }}
              >
                {formatOffset(t)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-center text-[11px] text-muted-foreground">
        Echtzeit-Radar · Rainbow.ai · Aktualisierung alle 10 Min
      </div>
    </div>
  );
}

function formatHourLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getNowcastContext(hourly: HourlyData): string {
  const n = Math.min(12, hourly.time.length);
  let rainIndex = -1;
  let thunderIndex = -1;
  for (let i = 0; i < n; i++) {
    const pop = hourly.precipitation_probability?.[i] ?? 0;
    const cape = hourly.cape?.[i] ?? 0;
    const lp = hourly.lightning_potential?.[i] ?? 0;
    if (rainIndex === -1 && pop > 30) rainIndex = i;
    if (thunderIndex === -1 && (cape > 500 || lp > 0.3)) thunderIndex = i;
  }
  if (rainIndex === -1 && thunderIndex === -1) return "Heute bleibt es den ganzen Tag trocken.";
  if (thunderIndex !== -1 && (thunderIndex < rainIndex || rainIndex === -1)) {
    return `Trocken bis mindestens ${formatHourLabel(hourly.time[thunderIndex])} Uhr — danach steigt die Gewittergefahr an.`;
  }
  return `Trocken bis mindestens ${formatHourLabel(hourly.time[rainIndex])} Uhr — danach Regen möglich.`;
}

function NowcastContextBox({ hourly }: { hourly: HourlyData }) {
  const text = getNowcastContext(hourly);
  return (
    <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-muted/40 px-3 py-2.5">
      <div className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] bg-primary">
        <Info className="h-3 w-3 text-primary-foreground" strokeWidth={2.25} />
      </div>
      <span className="text-[10px] font-medium leading-snug text-foreground">{text}</span>
    </div>
  );
}

function nowcastHasPrecip(data: RainbowNowcastResponse): boolean {
  return (data.forecast ?? []).some(
    (f) =>
      (f.precipRate ?? 0) > 0 &&
      f.precipType !== "no_precipitation" &&
      f.precipType !== "none",
  );
}

export function NowcastPage() {
  const [range, setRange] = useState<Range>(8);
  const { location } = useWeather();
  const rainbow = useRainbowNowcast();
  const minutes = range === 8 ? 120 : 360;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Radio className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Nowcast für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>
      <PageState>
        {(data) => {
          const hasRain = rainbow.data ? nowcastHasPrecip(rainbow.data) : false;
          return (
            <div>
              <div className="mb-2 px-1">
                <h2 className="font-display text-lg font-medium tracking-tight">Nowcast</h2>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Niederschlagsverlauf
                </span>
              </div>

              {/* Full-width segmented control */}
              <div className="mb-3.5 flex w-full rounded-[10px] bg-muted/60 p-[3px]">
                {[
                  { r: 8 as Range, label: "2 Stunden" },
                  { r: 24 as Range, label: "6 Stunden" },
                ].map(({ r, label }) => {
                  const active = range === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={`flex-1 cursor-pointer rounded-lg border-0 px-0 py-[7px] text-[12px] font-semibold transition-all ${
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {rainbow.data && !rainbow.isError ? (
                <>
                  <RainbowChart data={rainbow.data} minutes={minutes} />
                  {!hasRain && <NowcastContextBox hourly={data.hourly} />}
                </>
              ) : rainbow.isLoading ? (
                <div className="glass h-56 animate-pulse rounded-3xl" />
              ) : (
                <div className="space-y-2">
                  {rainbow.isError && (
                    <div className="text-xs text-muted-foreground">
                      Echtzeit-Nowcast nicht verfügbar – Fallback auf Open-Meteo.
                    </div>
                  )}
                  <Nowcast minutely={data.minutely_15} count={range} showHeader={false} />
                  <NowcastContextBox hourly={data.hourly} />
                </div>
              )}
            </div>
          );
        }}
      </PageState>
    </div>
  );
}
