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

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-colors sm:p-6"
      style={{ background: "#f0f4ff", borderColor: "#c0ccf0" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
          style={{ background: "#5a72d9" }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div
            className="text-[7.5px] font-semibold uppercase tracking-wider"
            style={{ color: "#4a5aba" }}
          >
            KI-Analyse · Experimentell
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h3
              className="text-[11px] font-bold tracking-tight"
              style={{ color: "#1a2a3a" }}
            >
              {warning.titel}
            </h3>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{ background: "#e8ecff", color: "#4a5aba" }}
            >
              {STUFE_LABEL[warning.stufe] ?? warning.stufe}
            </span>
          </div>
          <p className="mt-1 text-[9px] leading-relaxed" style={{ color: "#5a6a7a" }}>
            {warning.beschreibung}
          </p>
          <div className="mt-2">
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium"
              style={{ background: "#e8ecff", color: "#4a5aba" }}
            >
              Experimentell · Keine amtliche Warnung
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
