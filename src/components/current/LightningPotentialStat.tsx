import { Zap } from "lucide-react";
import { useThunderstormRisk } from "@/hooks/useThunderstormRisk";

const LEVEL_COLOR: Record<string, string> = {
  none: "#10b981",
  low: "#fbbf24",
  moderate: "#f97316",
  high: "#ef4444",
  extreme: "#7f1d1d",
};

export function LightningPotentialStat() {
  const risk = useThunderstormRisk();

  if (!risk.hasData) {
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

  const color = LEVEL_COLOR[risk.current.level];

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
        Gewitter-Potenzial
      </div>
      <div className="font-display text-2xl font-medium tabular-nums" style={{ color }}>
        {risk.current.score}
        <span className="text-base text-muted-foreground">/100</span>
      </div>
      <div className="mt-0.5 text-xs" style={{ color }}>
        {risk.current.label}
      </div>
    </div>
  );
}
