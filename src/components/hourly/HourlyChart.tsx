import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { HourlyData } from "@/lib/weather";

const HOURS = 24;

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function HourlyChart({ hourly }: { hourly: HourlyData }) {
  const rows = hourly.time.slice(0, HOURS).map((t, i) => ({
    time: formatHour(t),
    temp: Math.round(hourly.temperature_2m[i]),
    pop: hourly.precipitation_probability[i] ?? 0,
  }));

  return (
    <div className="glass rounded-3xl p-4 sm:p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-base font-medium">Temperaturverlauf &amp; Regenwahrscheinlichkeit</h3>
        <span className="text-xs text-muted-foreground">Nächste 24 h</span>
      </div>
      <div className="h-48 w-full sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 15, bottom: 4 }}>
            <CartesianGrid stroke="oklch(1 0 0 / 0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={2}
              minTickGap={16}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              yAxisId="temp"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
              unit="°"
            />
            <YAxis
              yAxisId="pop"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
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
              name="Regenwahrsch."
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
