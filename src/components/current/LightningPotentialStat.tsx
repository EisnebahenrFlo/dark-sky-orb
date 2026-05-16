import { Zap } from "lucide-react";
import type { HourlyData } from "@/lib/weather";

function levelFor(v: number): { label: string; color: string } {
  if (v >= 81) return { label: "Sehr hoch", color: "#7f1d1d" };
  if (v >= 61) return { label: "Hoch", color: "#ef4444" };
  if (v >= 41) return { label: "Mäßig", color: "#f97316" };
  if (v >= 21) return { label: "Schwach", color: "#fbbf24" };
  if (v >= 6) return { label: "Sehr schwach", color: "#10b981" };
  return { label: "Kein Potenzial", color: "#10b981" };
}

export function LightningPotentialStat({ hourly }: { hourly: HourlyData }) {
  const values = (hourly.lightning_potential ?? []).slice(0, 24);
  if (values.length === 0) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
          Gewitter-Potenzial
        </div>
        <div className="font-display text-2xl font-medium tabular-nums text-muted-foreground">—</div>
        <div className="mt-0.5 text-xs text-muted-foreground">Keine Daten</div>
      </div>
    );
  }

  const peak = Math.round(Math.max(...values));
  const level = levelFor(peak);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
        Gewitter-Potenzial
      </div>
      <div
        className="font-display text-2xl font-medium tabular-nums"
        style={{ color: level.color }}
      >
        {peak}
        <span className="text-base text-muted-foreground">/100</span>
      </div>
      <div className="mt-0.5 text-xs" style={{ color: level.color }}>
        {level.label}
      </div>
    </div>
  );
}
