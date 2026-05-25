import { useState } from "react";
import { Info, Radio } from "lucide-react";
import type { HourlyData } from "@/lib/weather";
import { Nowcast } from "@/components/Nowcast";
import { PageState } from "@/components/PageState";
import { useWeather } from "@/contexts/WeatherContext";
import {
  useRainbowNowcast,
  type RainbowNowcastItem,
  type RainbowNowcastResponse,
  type RainbowPrecipType,
} from "@/hooks/useRainbowNowcast";

type Range = 8 | 24;

type PrecipKind = "rain" | "snow" | "ice" | "none";

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
const MAX_RATE = 10;

function normalizeType(t: RainbowPrecipType): PrecipKind {
  if (t === "rain" || t === "snow" || t === "ice") return t;
  return "none";
}

interface Point {
  x: number;
  y: number;
  rate: number;
  type: PrecipKind;
  tsBegin: number;
  minOffset: number; // minutes from now
}

function buildPoints(items: RainbowNowcastItem[], nowSec: number, minutes: number): Point[] {
  const endSec = nowSec + minutes * 60;
  const filtered = items
    .filter((f) => f.timestampBegin >= nowSec - 60 && f.timestampBegin <= endSec)
    .sort((a, b) => a.timestampBegin - b.timestampBegin);

  return filtered.map((f) => {
    const minOffset = Math.max(0, (f.timestampBegin - nowSec) / 60);
    const rateClamped = Math.min(Math.max(f.precipRate ?? 0, 0), MAX_RATE);
    const x = (minOffset / minutes) * VB_W;
    const y = VB_H - (rateClamped / MAX_RATE) * VB_H;
    return {
      x,
      y,
      rate: f.precipRate ?? 0,
      type: normalizeType(f.precipType),
      tsBegin: f.timestampBegin,
      minOffset,
    };
  });
}

interface Segment {
  type: PrecipKind;
  points: Point[];
}

function buildSegments(points: Point[]): Segment[] {
  const segs: Segment[] = [];
  for (const p of points) {
    const last = segs[segs.length - 1];
    if (last && last.type === p.type) {
      last.points.push(p);
    } else {
      // overlap one point for visual continuity
      const seed = last ? [last.points[last.points.length - 1], p] : [p];
      segs.push({ type: p.type, points: [...seed] });
    }
  }
  return segs;
}

function areaPath(seg: Segment): string {
  if (seg.points.length === 0) return "";
  const pts = seg.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const top = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  return `${top} L ${last.x.toFixed(2)} ${VB_H} L ${first.x.toFixed(2)} ${VB_H} Z`;
}

function linePath(seg: Segment): string {
  if (seg.points.length === 0) return "";
  return seg.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

interface Marker {
  x: number;
  label: string;
}

function buildMarkers(points: Point[], minutes: number): Marker[] {
  const out: Marker[] = [];
  let wasPrecip = points[0] ? points[0].type !== "none" && points[0].rate > 0 : false;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const isPrecip = p.type !== "none" && p.rate > 0;
    if (isPrecip !== wasPrecip) {
      out.push({ x: (p.minOffset / minutes) * VB_W, label: isPrecip ? "beginnt" : "endet" });
      wasPrecip = isPrecip;
    }
  }
  return out;
}

function formatOffset(min: number): string {
  if (min === 0) return "Jetzt";
  if (min < 60) return `+${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `+${h}h`;
  return `+${h}:${String(m).padStart(2, "0")}h`;
}

function timeTicks(minutes: number): number[] {
  if (minutes <= 120) return [0, 30, 60, 90, 120];
  return [0, 60, 120, 180, 240, 300, 360];
}

function buildSummary(points: Point[], minutes: number): { text: string; warn: boolean } {
  if (points.length === 0) return { text: "Kein Niederschlag erwartet", warn: false };

  const hasIce = points.some((p) => p.type === "ice" && p.rate > 0);
  if (hasIce) return { text: "⚠️ Gefrierender Regen — Glatteisgefahr", warn: true };

  const isPrecip = (p: Point) => p.type !== "none" && p.rate > 0;
  const anyPrecip = points.some(isPrecip);
  if (!anyPrecip) {
    return { text: `Kein Niederschlag in den nächsten ${minutes < 60 ? minutes + " Min" : minutes / 60 + " h"}`, warn: false };
  }

  const first = points[0];
  if (isPrecip(first)) {
    // currently precipitating — find when it ends
    let endIdx = points.length;
    for (let i = 1; i < points.length; i++) {
      if (!isPrecip(points[i])) {
        endIdx = i;
        break;
      }
    }
    if (endIdx < points.length) {
      const minsLeft = Math.round(points[endIdx].minOffset);
      const label = first.type === "snow" ? "Schnee" : first.type === "ice" ? "Eis" : "Regen";
      return { text: `${label} noch ${minsLeft} Minuten`, warn: false };
    }
    const label = first.type === "snow" ? "Schnee" : "Regen";
    return { text: `${label} hält länger als ${minutes / 60}h an`, warn: false };
  }

  // find when precip begins
  const startIdx = points.findIndex(isPrecip);
  const start = points[startIdx];
  const minsTo = Math.round(start.minOffset);
  const label = start.type === "snow" ? "Schnee" : start.type === "ice" ? "Eis" : "Regen";
  return { text: `${label} in ${minsTo} Minuten`, warn: false };
}

function RainbowChart({ data, minutes }: { data: RainbowNowcastResponse; minutes: number }) {
  const nowSec = Date.now() / 1000;
  const points = buildPoints(data.forecast ?? [], nowSec, minutes);
  const segments = buildSegments(points);
  const markers = buildMarkers(points, minutes);
  const summary = buildSummary(points, minutes);
  const ticks = timeTicks(minutes);

  const presentTypes = Array.from(
    new Set(points.filter((p) => p.type !== "none" && p.rate > 0).map((p) => p.type)),
  ) as PrecipKind[];

  const noPrecip = points.length === 0 || presentTypes.length === 0;

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div
        className={`mb-1 text-sm ${summary.warn ? "font-medium text-orange-500" : "text-foreground"}`}
      >
        {summary.text}
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
          <div className="grid h-40 place-items-center text-center">
            <div>
              <div className="text-3xl">🌤️</div>
              <div className="mt-2 text-sm text-muted-foreground">Kein Niederschlag erwartet</div>
            </div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H + 20}`}
            preserveAspectRatio="none"
            width="100%"
            height="auto"
            className="block h-40 w-full max-w-full"
            aria-label="Niederschlagsverlauf"
          >
            {/* Baseline */}
            <line
              x1={0}
              y1={VB_H}
              x2={VB_W}
              y2={VB_H}
              stroke="#e0e8f0"
              strokeWidth={1.5}
              strokeLinecap="round"
            />


            {/* "Jetzt" dashed vertical */}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={VB_H}
              stroke="var(--muted-foreground)"
              strokeWidth={0.5}
              strokeDasharray="2 3"
              opacity={0.6}
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
                  <path d={areaPath(seg)} fill={c.fill} fillOpacity={0.5} stroke="none" />
                  <path
                    d={linePath(seg)}
                    fill="none"
                    stroke={c.stroke}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {/* Markers */}
            {markers.map((m, i) => (
              <g key={i}>
                <line
                  x1={m.x}
                  y1={0}
                  x2={m.x}
                  y2={VB_H}
                  stroke="var(--muted-foreground)"
                  strokeWidth={0.5}
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
                <text
                  x={m.x + 3}
                  y={10}
                  fontSize={8}
                  fill="var(--muted-foreground)"
                >
                  {m.label}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* Time axis labels */}
        <div className="relative mt-1 h-4 w-full overflow-visible px-2">
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
                style={{ left: `${leftPct}%` }}
              >
                {formatOffset(t)}
              </span>
            );
          })}
        </div>
      </div>

      {!noPrecip && (
        <div
          className="mt-3 rounded-lg px-2.5 py-2"
          style={{ background: "#f8fafc" }}
        >
          <span className="text-[9.5px] leading-snug" style={{ color: "#3a5a7a" }}>
            {summary.text}
          </span>
        </div>
      )}


      {presentTypes.length > 1 && (
        <div className="mt-3 flex justify-center gap-3 text-xs text-muted-foreground">
          {presentTypes.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              {TYPE_EMOJI[t]} {TYPE_LABEL[t]}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 text-center text-xs text-muted-foreground">
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
    <div
      className="mt-3 flex items-center gap-3 rounded-[10px] px-3 py-2.5"
      style={{ background: "#f0f6ff" }}
    >
      <div
        className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px]"
        style={{ background: "#2a6dd9" }}
      >
        <Info className="h-3 w-3 text-white" strokeWidth={2.25} />
      </div>
      <span className="text-[10px] font-medium leading-snug" style={{ color: "#1a3a6a" }}>
        {text}
      </span>
    </div>
  );
}

function nowcastHasPrecip(data: RainbowNowcastResponse): boolean {
  return (data.forecast ?? []).some((f) => (f.precipRate ?? 0) > 0 && f.precipType !== "no_precipitation" && f.precipType !== "none");
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
              <div
                className="mb-3.5 flex w-full rounded-[10px] p-[3px]"
                style={{ background: "#f0f4f8" }}
              >
                {[
                  { r: 8 as Range, label: "2 Stunden" },
                  { r: 24 as Range, label: "6 Stunden" },
                ].map(({ r, label }) => {
                  const active = range === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className="flex-1 rounded-lg border-0 px-0 py-[7px] text-[12px] font-semibold transition-all"
                      style={{
                        background: active ? "white" : "transparent",
                        color: active ? "#1a2a3a" : "#8a9ab0",
                        boxShadow: active ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                        cursor: "pointer",
                      }}
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

