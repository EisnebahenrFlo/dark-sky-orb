import { useState } from "react";
import { Info, Radio, CloudSun } from "lucide-react";
import type { HourlyData } from "@/lib/weather";
import { Nowcast } from "@/components/Nowcast";
import { PageState } from "@/components/PageState";
import { useWeather } from "@/contexts/WeatherContext";
import {
  useRainbowNowcast,
  type RainbowNowcastResponse,
} from "@/hooks/useRainbowNowcast";
import {
  buildCells,
  buildPoints,
  buildSummary,
  findPeak,
  formatOffset,
  formatRate,
  intensityLabel,
  type IntensityBucket,
  type NowcastCell,
  type PrecipKind,
} from "@/lib/rainbowNowcast";

type Range = 8 | 24;

const VB_W = 600;
const VB_H = 100;

// Apple-Weather-style intensity colors. Per kind × bucket.
const BUCKET_COLORS: Record<PrecipKind, Record<IntensityBucket, string>> = {
  rain: {
    none: "transparent",
    drizzle: "oklch(0.92 0.04 235)",
    light: "oklch(0.82 0.10 235)",
    moderate: "oklch(0.68 0.16 235)",
    heavy: "oklch(0.55 0.20 250)",
    extreme: "oklch(0.42 0.22 265)",
  },
  snow: {
    none: "transparent",
    drizzle: "oklch(0.94 0.03 290)",
    light: "oklch(0.85 0.06 290)",
    moderate: "oklch(0.72 0.10 290)",
    heavy: "oklch(0.60 0.14 290)",
    extreme: "oklch(0.50 0.18 290)",
  },
  ice: {
    none: "transparent",
    drizzle: "oklch(0.92 0.05 10)",
    light: "oklch(0.82 0.10 10)",
    moderate: "oklch(0.70 0.16 10)",
    heavy: "oklch(0.58 0.20 10)",
    extreme: "oklch(0.48 0.22 10)",
  },
  none: {
    none: "transparent",
    drizzle: "transparent",
    light: "transparent",
    moderate: "transparent",
    heavy: "transparent",
    extreme: "transparent",
  },
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

function cellColor(cell: NowcastCell): string {
  if (cell.missing) return "var(--muted)";
  if (cell.bucket === "none") return "transparent";
  return BUCKET_COLORS[cell.type][cell.bucket];
}

interface AxisTick {
  minOffset: number;
  label: string;
}

function buildAxisTicks(minutes: number): AxisTick[] {
  const step = minutes <= 120 ? 30 : 60;
  const out: AxisTick[] = [];
  for (let m = 0; m <= minutes; m += step) {
    out.push({ minOffset: m, label: formatOffset(m) });
  }
  return out;
}

function IntensityStrip({ data, minutes }: { data: RainbowNowcastResponse; minutes: number }) {
  const nowSec = Date.now() / 1000;
  const cells = buildCells(data.forecast ?? [], nowSec, minutes, 10);
  // Reuse buildPoints for summary + peak (they expect points, not cells).
  const points = buildPoints(data.forecast ?? [], nowSec, minutes, VB_W, VB_H, 100);
  const summary = buildSummary(points, minutes, nowSec);
  const peak = findPeak(points);
  const ticks = buildAxisTicks(minutes);

  const presentTypes = Array.from(
    new Set(cells.filter((c) => c.bucket !== "none").map((c) => c.type)),
  ) as PrecipKind[];
  const noPrecip = presentTypes.length === 0;

  // Total expected mm in the window (sum rate × slot duration).
  const slotHours = 10 / 60;
  const totalMm = cells.reduce((s, c) => s + c.rate * slotHours, 0);

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      {/* Headline */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-base font-semibold leading-tight ${summary.warn ? "text-orange-500" : "text-foreground"}`}
          >
            {summary.text}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {noPrecip
              ? "Radar zeigt nichts in Reichweite"
              : `Spitze ${formatRate(peak?.rate ?? 0)} · ${intensityLabel(peak?.rate ?? 0)}`}
            {!noPrecip && totalMm >= 0.1 && (
              <>
                {" · "}
                <span className="tabular-nums">{totalMm.toFixed(1).replace(".", ",")} mm gesamt</span>
              </>
            )}
          </div>
        </div>
        {presentTypes.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            {presentTypes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground"
              >
                {TYPE_EMOJI[t]} {TYPE_LABEL[t]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Strip */}
      {noPrecip ? (
        <div className="mt-5 grid h-32 place-items-center text-center text-muted-foreground">
          <div>
            <CloudSun className="mx-auto h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
            <div className="mt-2 text-sm">Kein Niederschlag erwartet</div>
            <div className="mt-0.5 text-[11px] opacity-70">
              Nächste {minutes < 60 ? `${minutes} Minuten` : `${minutes / 60} Stunden`}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5">
            {/* Cells */}
            <div
              className="flex h-12 w-full overflow-hidden rounded-xl border border-border/60 bg-muted/30"
              role="img"
              aria-label="Niederschlagsintensität pro 10 Minuten"
            >
              {cells.map((c, i) => (
                <div
                  key={i}
                  className="relative flex-1 transition-opacity"
                  style={{
                    background: cellColor(c),
                    opacity: c.missing ? 0.35 : 1,
                  }}
                  title={
                    c.missing
                      ? `+${c.minOffset} Min · keine Daten`
                      : c.bucket === "none"
                        ? `+${c.minOffset} Min · trocken`
                        : `+${c.minOffset} Min · ${formatRate(c.rate)} · ${intensityLabel(c.rate)}`
                  }
                />
              ))}
            </div>

            {/* "Jetzt" indicator above first cell */}
            <div className="relative -mt-12 h-12 pointer-events-none">
              <div className="absolute left-0 top-0 h-12 w-0.5 bg-foreground/60" />
              <div className="absolute left-1 top-1 rounded-sm bg-foreground/85 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-background">
                Jetzt
              </div>
              {/* Peak marker */}
              {peak && (
                <div
                  className="absolute -top-1 h-2 w-2 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow-sm"
                  style={{ left: `${Math.min(99, Math.max(1, (peak.minOffset / minutes) * 100))}%` }}
                  aria-label={`Spitze bei ${formatOffset(Math.round(peak.minOffset))}`}
                />
              )}
            </div>
          </div>

          {/* Time axis */}
          <div className="relative mt-2 h-4 w-full">
            {ticks.map((t, i) => {
              const leftPct = (t.minOffset / minutes) * 100;
              const isFirst = i === 0;
              const isLast = i === ticks.length - 1;
              return (
                <span
                  key={t.minOffset}
                  className={`absolute text-[10px] text-muted-foreground tabular-nums ${
                    isFirst
                      ? "text-left"
                      : isLast
                        ? "-translate-x-full text-right"
                        : "-translate-x-1/2"
                  }`}
                  style={{ left: `${leftPct}%` }}
                >
                  {t.label}
                </span>
              );
            })}
          </div>

          {/* Intensity legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="opacity-70">Intensität:</span>
            {(["drizzle", "light", "moderate", "heavy", "extreme"] as IntensityBucket[]).map((b) => (
              <span key={b} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-3 rounded-sm border border-border/40"
                  style={{ background: BUCKET_COLORS.rain[b] }}
                />
                {b === "drizzle"
                  ? "Niesel"
                  : b === "light"
                    ? "leicht"
                    : b === "moderate"
                      ? "mäßig"
                      : b === "heavy"
                        ? "stark"
                        : "sehr stark"}
              </span>
            ))}
          </div>
        </>
      )}

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
      <h1 className="sr-only">Nowcast</h1>
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
                  <IntensityStrip data={rainbow.data} minutes={minutes} />
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
                  <Nowcast minutely={data.minutely_15} hourly={data.hourly} count={range} showHeader={false} />
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
