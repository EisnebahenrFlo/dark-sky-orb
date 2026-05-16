import { Fragment } from "react";
import type { DailyData, HourlyData } from "@/lib/weather";
import { HourlyRow, type HourlyRowData } from "./HourlyRow";
import { SunDivider } from "./SunDivider";

const HOURS = 24;

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDayHeader(iso: string) {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("de-DE", { weekday: "long" });
  const date = d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  return `${weekday}, ${date}`;
}

interface SunEvent {
  kind: "sunrise" | "sunset";
  iso: string;
  label: string;
}

export function HourlyList({ hourly, daily }: { hourly: HourlyData; daily: DailyData }) {
  const now = Date.now();

  // Build sun events that fall within the displayed window.
  const events: SunEvent[] = [];
  daily.sunrise.slice(0, 3).forEach((s) =>
    events.push({ kind: "sunrise", iso: s, label: formatHour(s) }),
  );
  daily.sunset.slice(0, 3).forEach((s) =>
    events.push({ kind: "sunset", iso: s, label: formatHour(s) }),
  );

  const rows: HourlyRowData[] = hourly.time.slice(0, HOURS).map((t, i) => {
    const ts = new Date(t).getTime();
    const isCurrent = ts <= now && now < ts + 60 * 60 * 1000;
    return {
      iso: t,
      label: isCurrent ? "Jetzt" : formatHour(t),
      temp: hourly.temperature_2m[i],
      apparent: hourly.apparent_temperature?.[i] ?? hourly.temperature_2m[i],
      pop: hourly.precipitation_probability[i] ?? 0,
      precip: hourly.precipitation[i] ?? 0,
      wind: Math.round(hourly.wind_speed_10m[i]),
      uv: hourly.uv_index?.[i] ?? 0,
      code: hourly.weather_code[i],
      isDay: hourly.is_day[i],
      cloud: hourly.cloud_cover?.[i] ?? 0,
      isCurrent,
      cape: hourly.cape?.[i] ?? null,
      li: hourly.lifted_index?.[i] ?? null,
    };
  });

  // Render with day-change headers and sun-event dividers between rows.
  const items: Array<
    | { kind: "row"; row: HourlyRowData }
    | { kind: "day"; label: string; key: string }
    | { kind: "sun"; event: SunEvent; key: string }
  > = [];

  let lastDay = "";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const dayKey = row.iso.slice(0, 10);

    if (dayKey !== lastDay) {
      // Skip header for the very first item (current day is implied)
      if (lastDay !== "") {
        items.push({ kind: "day", label: formatDayHeader(row.iso), key: `day-${dayKey}` });
      }
      lastDay = dayKey;
    }

    items.push({ kind: "row", row });

    // Insert sun event if it falls between this row and the next
    const next = rows[i + 1];
    if (next) {
      const a = new Date(row.iso).getTime();
      const b = new Date(next.iso).getTime();
      const ev = events.find((e) => {
        const t = new Date(e.iso).getTime();
        return t >= a && t < b;
      });
      if (ev) items.push({ kind: "sun", event: ev, key: `sun-${ev.iso}` });
    }
  }

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="divide-y divide-border/50">
        {items.map((item, idx) => {
          if (item.kind === "row") {
            return <HourlyRow key={`row-${item.row.iso}`} row={item.row} />;
          }
          if (item.kind === "sun") {
            return <SunDivider key={item.key} kind={item.event.kind} time={item.event.label} />;
          }
          return (
            <div
              key={item.key}
              className="bg-muted/30 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { HOURS as HOURLY_LIST_HOURS };
