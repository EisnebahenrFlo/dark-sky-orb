import { useState } from "react";
import { Radio } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Nowcast } from "@/components/Nowcast";
import { PageState } from "@/components/PageState";
import { useWeather } from "@/contexts/WeatherContext";
import { useRainbowNowcast, type RainbowNowcastItem, type RainbowNowcastResponse } from "@/hooks/useRainbowNowcast";
import { useTheme } from "@/hooks/useTheme";
import { safeFixed } from "@/lib/safeFormat";

type Range = 8 | 24;

const INTENSITY_LABEL: Record<RainbowNowcastResponse["summary"]["intensity"], string> = {
  none: "Kein Niederschlag erwartet",
  light: "Leichter Niederschlag erwartet",
  moderate: "Mäßiger Niederschlag erwartet",
  heavy: "Starker Niederschlag erwartet",
  extreme: "Extremer Niederschlag erwartet",
};

function rainbowColors(isDark: boolean): Record<RainbowNowcastItem["precipType"], string> {
  return {
    rain: "oklch(0.78 0.16 230)",
    snow: isDark ? "#e2e8f0" : "#94a3b8",
    ice: "oklch(0.65 0.22 300)",
    none: "oklch(0.4 0.02 260)",
  };
}

function formatHHMM(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function RainbowChart({ data, minutes }: { data: RainbowNowcastResponse; minutes: number }) {
  const { resolved } = useTheme();
  const COLORS = rainbowColors(resolved === "dark");
  const nowSec = Date.now() / 1000;
  const endSec = nowSec + minutes * 60;

  const items = (data.forecast ?? []).filter(
    (f) => f.timestampBegin >= nowSec - 60 && f.timestampBegin <= endSec,
  );

  const points = items.map((f) => ({
    time: formatHHMM(f.timestampBegin),
    precip: Math.min(f.precipRate ?? 0, 10),
    rawRate: f.precipRate ?? 0,
    type: f.precipType,
  }));

  const total = points.reduce((s, p) => s + p.rawRate, 0);

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="mb-3 text-sm text-muted-foreground">
        {INTENSITY_LABEL[data.summary?.intensity ?? "none"]}
      </div>
      {total === 0 || points.length === 0 ? (
        <div className="grid h-44 place-items-center text-center">
          <div>
            <div className="text-3xl">🌤️</div>
            <div className="mt-2 text-muted-foreground">Kein Niederschlag erwartet</div>
          </div>
        </div>
      ) : (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                domain={[0, 10]}
                unit=" mm/h"
              />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(_v: number, _n, ctx: any) => [
                  `${safeFixed(ctx?.payload?.rawRate ?? 0, 2)} mm/h`,
                  "Intensität",
                ]}
              />
              <Bar dataKey="precip" radius={[6, 6, 2, 2]}>
                {points.map((p, i) => (
                  <Cell key={i} fill={COLORS[p.type] ?? COLORS.none} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-3 text-center text-xs text-muted-foreground">
        Echtzeit-Radar · Rainbow.ai · Aktualisierung alle 10 Min
      </div>
    </div>
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
        {(data) => (
          <div>
            <div className="mb-3 flex items-start justify-between gap-3 px-1">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-medium tracking-tight">Nowcast</h2>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {(range * 15) / 60} h Niederschlagsverlauf
                </span>
              </div>
              <div className="glass flex gap-0.5 rounded-full p-0.5 text-xs">
                {[8, 24].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r as Range)}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      range === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {(r * 15) / 60}h
                  </button>
                ))}
              </div>
            </div>
            {rainbow.data && !rainbow.isError ? (
              <RainbowChart data={rainbow.data} minutes={minutes} />
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
              </div>
            )}
          </div>
        )}
      </PageState>
    </div>
  );
}
