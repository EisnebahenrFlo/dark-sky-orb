import { Droplets, Thermometer, Wind } from "lucide-react";
import { KISicherheitBadge } from "@/components/KISicherheitBadge";
import { WeatherIcon } from "@/components/WeatherIcon";
import { useWeather } from "@/contexts/WeatherContext";

function pickHighlightDay(highlight: string): { idx: number; label: string } {
  const t = highlight.toLowerCase();
  if (t.startsWith("übermorgen") || t.includes("übermorgen ")) return { idx: 2, label: "Übermorgen" };
  if (t.startsWith("morgen") || t.includes(" morgen ")) return { idx: 1, label: "Morgen" };
  return { idx: 0, label: "Heute" };
}

function formatWeekday(iso: string) {
  try {
    const d = new Date(iso);
    return d
      .toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })
      .replace(".", "");
  } catch {
    return "";
  }
}

export function HeroCard({
  highlight,
  confidenceScore,
  confidenceReason,
}: {
  highlight: string;
  confidenceScore: number;
  confidenceReason?: string;
}) {
  const { data } = useWeather();
  const daily = data?.daily;
  const { idx, label } = pickHighlightDay(highlight);
  const safeIdx = daily && daily.time && idx < daily.time.length ? idx : 0;

  const max = daily?.temperature_2m_max?.[safeIdx];
  const min = daily?.temperature_2m_min?.[safeIdx];
  const code = daily?.weather_code?.[safeIdx];
  const wind = daily?.wind_speed_10m_max?.[safeIdx];
  const precip = daily?.precipitation_sum?.[safeIdx];
  const dateStr = daily?.time?.[safeIdx] ? formatWeekday(daily.time[safeIdx]) : "";

  const hasStats = max != null || min != null || wind != null || precip != null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        {code != null && (
          <div className="shrink-0 rounded-xl bg-muted/60 p-2.5">
            <WeatherIcon code={code} isDay={1} size={40} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {dateStr && (
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label} · {dateStr}
            </div>
          )}
          <p className="font-display text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl sm:leading-snug">
            {highlight}
          </p>
        </div>
      </div>

      {hasStats && (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-4">
          <Stat
            icon={<Thermometer className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Max"
            value={max != null ? `${Math.round(max)}°` : "—"}
          />
          <Stat
            icon={<Thermometer className="h-3.5 w-3.5 rotate-180" strokeWidth={1.75} />}
            label="Min"
            value={min != null ? `${Math.round(min)}°` : "—"}
          />
          <Stat
            icon={<Wind className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Wind"
            value={wind != null ? `${Math.round(wind)} km/h` : "—"}
          />
          <Stat
            icon={<Droplets className="h-3.5 w-3.5" strokeWidth={1.75} />}
            label="Regen"
            value={precip != null ? `${precip.toFixed(precip < 1 ? 1 : 0)} mm` : "—"}
          />
        </div>
      )}

      {confidenceReason && (
        <p className="mt-3 text-xs text-muted-foreground sm:text-sm">{confidenceReason}</p>
      )}
      <div className="mt-4">
        <KISicherheitBadge confidence={confidenceScore} />
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-0.5 font-display text-base font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
