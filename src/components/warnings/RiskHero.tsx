import type { RiskWarnings } from "@/hooks/useRiskWarnings";
import { colorClasses, type RiskColorKey } from "./colors";

const LEVEL_LABEL: Record<string, string> = {
  kein: "Kein Risiko",
  schwach: "Schwach",
  mäßig: "Mäßig",
  hoch: "Hoch",
  sehr_hoch: "Sehr hoch",
  extrem: "Extrem",
};

export function RiskHero({ risk }: { risk: RiskWarnings["gewitter_risiko_6h"] }) {
  const c = colorClasses[(risk.color as RiskColorKey) ?? "green"] ?? colorClasses.green;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-l-4 ${c.border} border-y border-r border-border bg-card p-6 shadow-sm sm:p-8`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Gewitter-Risiko · nächste 6 h
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className={`font-display text-6xl font-semibold tracking-tight ${c.text}`}>
              {risk.score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full ${c.bg} ${c.text} px-3 py-1 text-xs font-semibold uppercase tracking-wider`}
        >
          {LEVEL_LABEL[risk.level] ?? risk.level}
        </span>
      </div>

      {(risk.zeitfenster || risk.konvektionstyp) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {risk.zeitfenster && (
            <span>
              <span className="font-medium text-foreground">Zeitfenster:</span> {risk.zeitfenster}
            </span>
          )}
          {risk.konvektionstyp && (
            <span>
              <span className="font-medium text-foreground">Typ:</span> {risk.konvektionstyp}
            </span>
          )}
        </div>
      )}

      {risk.begründung && (
        <p className="mt-4 text-sm leading-relaxed text-foreground/85">{risk.begründung}</p>
      )}
    </div>
  );
}
