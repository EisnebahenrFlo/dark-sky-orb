import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { precipKind, formatTime, type MinutelyData } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";
import { SectionHeader } from "./SectionHeader";

const KIND_COLOR: Record<string, string> = {
  rain: "oklch(0.78 0.16 230)",
  shower: "oklch(0.7 0.18 300)",
  snow: "oklch(0.97 0.01 250)",
  none: "oklch(0.4 0.02 260)",
};

export function Nowcast({
  minutely,
  count = 8,
  showHeader = true,
}: {
  minutely: MinutelyData;
  count?: number;
  showHeader?: boolean;
}) {
  const points = minutely.time.slice(0, count).map((t, i) => ({
    time: formatTime(t),
    iso: t,
    precip: minutely.precipitation[i] ?? 0,
    code: minutely.weather_code[i] ?? 0,
    kind: precipKind(minutely.weather_code[i] ?? 0),
  }));

  const totalPrecip = points.reduce((s, p) => s + p.precip, 0);
  const hours = Math.round((count * 15) / 60);

  return (
    <section>
      {showHeader && (
        <SectionHeader title="Nowcast" subtitle={`Nächste ${hours} Stunden · 15-Min-Schritte`} />
      )}
      <div className="glass rounded-3xl p-5 sm:p-6">
        {totalPrecip === 0 ? (
          <div className="grid h-44 place-items-center text-center">
            <div>
              <div className="text-3xl">🌤️</div>
              <div className="mt-2 text-muted-foreground">Kein Niederschlag erwartet</div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 10, right: 4, left: -16, bottom: 0 }}>
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
                    width={40}
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
                    formatter={(v: number) => [`${v.toFixed(2)} mm`, "Niederschlag"]}
                  />
                  <Bar dataKey="precip" radius={[6, 6, 2, 2]}>
                    {points.map((p, i) => (
                      <Cell key={i} fill={KIND_COLOR[p.kind]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-8 gap-1">
              {points.map((p, i) => (
                <div key={i} className="flex justify-center text-muted-foreground">
                  <WeatherIcon code={p.code} isDay={1} className="h-4 w-4" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
