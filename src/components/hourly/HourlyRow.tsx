import { Droplets, Wind } from "lucide-react";
import { safeFixed } from "@/lib/safeFormat";
import { EffectiveWeatherIcon } from "@/components/WeatherIcon";
import { getEffectiveWeather } from "@/lib/weatherDescription";

export interface HourlyRowData {
  iso: string;
  label: string;          // "Jetzt" or "07:00"
  temp: number;
  apparent: number;
  pop: number;            // precipitation probability %
  precip: number;         // mm
  wind: number;           // km/h
  uv: number;
  code: number;
  isDay: number;
  cloud: number;
  isCurrent: boolean;
}

export function HourlyRow({ row }: { row: HourlyRowData }) {
  const popHigh = row.pop >= 50;
  const eff = getEffectiveWeather(row.code, row.precip, row.cloud, row.isDay);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 transition-colors sm:gap-4 sm:px-4 ${
        row.isCurrent ? "bg-primary/5" : "hover:bg-white/[0.02]"
      }`}
    >
      {/* Time */}
      <div className="w-14 shrink-0 sm:w-16">
        <div
          className={`text-sm tabular-nums ${
            row.isCurrent ? "font-semibold text-foreground" : "text-foreground/90"
          }`}
        >
          {row.label}
        </div>
      </div>

      {/* Icon + description */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <EffectiveWeatherIcon
          code={row.code}
          precipitation={row.precip}
          cloudCover={row.cloud}
          isDay={row.isDay}
          className="h-6 w-6 shrink-0 text-primary"
        />
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {eff.description}
        </span>
      </div>

      {/* Temp */}
      <div className="w-12 shrink-0 text-right font-display text-base tabular-nums sm:w-16 sm:text-lg">
        {Math.round(row.temp)}°
      </div>

      {/* Precipitation prob */}
      <div className="flex w-16 shrink-0 items-center justify-end gap-1 text-xs tabular-nums sm:w-20">
        <Droplets
          className={`h-3.5 w-3.5 ${popHigh ? "text-primary" : "text-muted-foreground/60"}`}
          strokeWidth={1.75}
        />
        <span className={popHigh ? "text-foreground" : "text-muted-foreground"}>
          {row.pop}%
        </span>
      </div>

      {/* Precipitation amount (only when > 0) */}
      <div className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
        {row.precip > 0 ? `${safeFixed(row.precip, 1)} mm` : "—"}
      </div>

      {/* Wind */}
      <div className="flex w-16 shrink-0 items-center justify-end gap-1 text-xs tabular-nums text-muted-foreground sm:w-20">
        <Wind className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>{row.wind} km/h</span>
      </div>

      {/* UV (desktop only) */}
      <div className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground lg:block">
        UV {Math.round(row.uv ?? 0)}
      </div>
    </div>
  );
}
