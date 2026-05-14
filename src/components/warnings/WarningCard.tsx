import {
  AlertTriangle,
  CloudRain,
  Snowflake,
  Thermometer,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { RiskWarning } from "@/hooks/useRiskWarnings";
import { colorClasses, type RiskColorKey } from "./colors";

const ICONS: Record<string, LucideIcon> = {
  Wind,
  CloudRain,
  Zap,
  Snowflake,
  Thermometer,
  AlertTriangle,
};

const STUFE_LABEL: Record<string, string> = {
  markant: "Markant",
  unwetter: "Unwetter",
  extrem: "Extrem",
};

export function WarningCard({ warning }: { warning: RiskWarning }) {
  const Icon = ICONS[warning.icon] ?? AlertTriangle;
  const c = colorClasses[(warning.color as RiskColorKey) ?? "yellow"] ?? colorClasses.yellow;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-y border-r border-border border-l-4 ${c.border} bg-card p-5 shadow-sm transition-colors hover:border-foreground/20 sm:p-6`}
    >
      <div className="flex items-start gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${c.bg} ${c.text}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {warning.titel}
            </h3>
            <span
              className={`shrink-0 rounded-full ${c.bg} ${c.text} px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider`}
            >
              {STUFE_LABEL[warning.stufe] ?? warning.stufe}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {warning.beschreibung}
          </p>
        </div>
      </div>
    </div>
  );
}
