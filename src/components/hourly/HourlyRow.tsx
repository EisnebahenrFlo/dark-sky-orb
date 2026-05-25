import { Droplets, Wind, Zap } from "lucide-react";
import { safeFixed } from "@/lib/safeFormat";
import { RealisticWeatherIcon } from "@/components/RealisticWeatherIcon";
import { getEffectiveWeather } from "@/lib/weatherDescription";
import type { ThunderstormRisk } from "@/hooks/useThunderstormRisk";

const THUNDER_COLOR: Record<ThunderstormRisk["level"], string> = {
  none: "#10b981",
  low: "#fbbf24",
  moderate: "#f97316",
  high: "#ef4444",
  extreme: "#7f1d1d",
};

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
  cloudLow?: number;
  humidity?: number;
  overrideHour?: number;
  isCurrent: boolean;
  thunder: ThunderstormRisk;
}

export function HourlyRow({ row, showPrecipColumn = true }: { row: HourlyRowData; showPrecipColumn?: boolean }) {
  const popHigh = row.pop >= 50;
  const eff = getEffectiveWeather(
    row.code,
    row.precip,
    row.cloud,
    row.isDay,
    row.humidity,
    row.overrideHour ?? new Date(row.iso).getHours(),
    row.cloudLow,
  );
  const thunder = row.thunder;
  const thunderColor = THUNDER_COLOR[thunder.level];
  const showThunder = thunder.score >= 11;

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
        <RealisticWeatherIcon
          code={row.code}
          isDay={(row.isDay ? 1 : 0) as 0 | 1}
          size={26}
          className="shrink-0"
        />
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">
          {eff.description}
        </span>
      </div>

      {/* Temp */}
      <div className="w-12 shrink-0 text-right font-display text-base tabular-nums sm:w-16 sm:text-lg">
        {Math.round(row.temp)}°
      </div>

      {/* Precipitation prob + mobile thunder dot */}
      {showPrecipColumn && (
        <div className="flex w-16 shrink-0 items-center justify-end gap-1 text-xs tabular-nums sm:w-20">
          {showThunder && (
            <span
              className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full sm:hidden"
              style={{ backgroundColor: thunderColor }}
              title={`Gewitter: ${thunder.label}`}
              aria-label={`Gewitter: ${thunder.label}`}
            />
          )}
          <Droplets
            className={`h-3.5 w-3.5 ${popHigh ? "text-primary" : "text-muted-foreground/60"}`}
            strokeWidth={1.75}
          />
          <span className={popHigh ? "text-foreground" : "text-muted-foreground"}>
            {row.pop > 0 ? `${row.pop}%` : "—"}
          </span>
        </div>
      )}

      {/* Precipitation amount (only when > 0) */}
      <div className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
        {row.precip > 0 ? `${safeFixed(row.precip, 1)} mm` : "—"}
      </div>

      {/* Thunder (desktop) */}
      <div className="hidden w-20 shrink-0 items-center justify-end gap-1 text-xs tabular-nums sm:flex">
        {showThunder ? (
          <>
            <Zap
              className="h-3.5 w-3.5"
              strokeWidth={1.75}
              style={{ color: thunderColor }}
            />
            <span style={{ color: thunderColor }}>{thunder.label}</span>
          </>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
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
