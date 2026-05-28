import { safeFixed } from "@/lib/safeFormat";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { CloudSun } from "lucide-react";
import { precipKind, formatTime, type MinutelyData, type HourlyData } from "@/lib/weather";
import { EffectiveWeatherIcon } from "./WeatherIcon";
import { SectionHeader } from "./SectionHeader";
import { LiveBadge } from "./LiveBadge";
import { useTheme } from "@/hooks/useTheme";

function kindColors(isDark: boolean): Record<string, string> {
  return {
    rain: "oklch(0.78 0.16 230)",
    shower: "oklch(0.7 0.18 300)",
    // Slate tones for stronger contrast against glass backgrounds.
    // Light mode: slate-400 (#94a3b8). Dark mode: slate-200 (#e2e8f0).
    snow: isDark ? "#e2e8f0" : "#94a3b8",
    none: "oklch(0.4 0.02 260)",
  };
}

/** Nearest-hour lookup in stündliche Reihen für Cloud-Cover-Interpolation. */
function nearestHourIdx(times: string[] | undefined, iso: string): number {
  if (!times || times.length === 0) return -1;
  const t = new Date(iso).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - t);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

export function Nowcast({
  minutely,
  hourly,
  count = 8,
  showHeader = true,
}: {
  minutely: MinutelyData;
  hourly?: HourlyData;
  count?: number;
  showHeader?: boolean;
}) {
  const { resolved } = useTheme();
  const KIND_COLOR = kindColors(resolved === "dark");
  const points = minutely.time.slice(0, count).map((t, i) => {
    const hIdx = nearestHourIdx(hourly?.time, t);
    return {
      time: formatTime(t),
      iso: t,
      precip: minutely.precipitation[i] ?? 0,
      code: minutely.weather_code[i] ?? 0,
      kind: precipKind(minutely.weather_code[i] ?? 0),
      cloud: hIdx >= 0 ? (hourly?.cloud_cover?.[hIdx] ?? 50) : 50,
      cloudLow: hIdx >= 0 ? hourly?.cloud_cover_low?.[hIdx] : undefined,
      cloudMid: hIdx >= 0 ? hourly?.cloud_cover_mid?.[hIdx] : undefined,
      isDay: hIdx >= 0 ? (hourly?.is_day?.[hIdx] ?? 1) : 1,
    };
  });

  const totalPrecip = points.reduce((s, p) => s + p.precip, 0);
  const hours = Math.round((count * 15) / 60);

  return (
    <section>
      {showHeader && (
        <SectionHeader title="Nowcast" subtitle={`Nächste ${hours} Stunden · 15-Min-Schritte`} accessory={<LiveBadge />} />
      )}
      <div className="glass rounded-3xl p-5 sm:p-6">
        {totalPrecip === 0 ? (
          <div className="grid h-44 place-items-center text-center text-muted-foreground">
            <div>
              <CloudSun className="mx-auto h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
              <div className="mt-2">Kein Niederschlag erwartet</div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    unit=" mm"
                  />
                  <Tooltip
                    cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${safeFixed(v, 2)} mm`, "Niederschlag"]}
                  />
                  <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
                  <Bar dataKey="precip" radius={[6, 6, 2, 2]}>
                    {points.map((p, i) => (
                      <Cell key={i} fill={KIND_COLOR[p.kind]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div
              className="mt-2 grid gap-1"
              style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
            >
              {points.map((p, i) => (
                <div key={i} className="flex justify-center text-muted-foreground">
                  <EffectiveWeatherIcon code={p.code} precipitation={p.precip} cloudCover={50} isDay={1} className="h-4 w-4" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
