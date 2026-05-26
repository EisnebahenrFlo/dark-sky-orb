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

type ColorKey = "green" | "yellow" | "orange" | "red" | "purple";

const COLOR_STYLES: Record<ColorKey, {
  bar: string;
  bg: string;
  border: string;
  icon: string;
  badge: string;
}> = {
  green: {
    bar: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    border: "rgba(34,197,94,0.25)",
    icon: "#16a34a",
    badge: "bg-green-500 text-white",
  },
  yellow: {
    bar: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
    icon: "#d97706",
    badge: "bg-amber-400 text-amber-950",
  },
  orange: {
    bar: "#f97316",
    bg: "rgba(249,115,22,0.10)",
    border: "rgba(249,115,22,0.25)",
    icon: "#ea580c",
    badge: "bg-orange-500 text-white",
  },
  red: {
    bar: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.25)",
    icon: "#dc2626",
    badge: "bg-red-500 text-white",
  },
  purple: {
    bar: "#a855f7",
    bg: "rgba(168,85,247,0.10)",
    border: "rgba(168,85,247,0.25)",
    icon: "#9333ea",
    badge: "bg-purple-500 text-white",
  },
};

function resolveColor(c: string): ColorKey {
  return (c in COLOR_STYLES ? c : "yellow") as ColorKey;
}

export function WarningCard({ warning }: { warning: RiskWarning }) {
  const Icon = ICONS[warning.icon] ?? AlertTriangle;
  const color = COLOR_STYLES[resolveColor(warning.color)];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 pl-6 shadow-sm transition-colors sm:p-6 sm:pl-7"
      style={{ background: color.bg, borderColor: color.border }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full"
        style={{ width: "4px", background: color.bar }}
      />
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ background: "rgba(255,255,255,0.6)", color: color.icon }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="flex-1">
          <div
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: color.icon }}
          >
            KI-Analyse · Experimentell
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h3
              className="text-base font-semibold tracking-tight"
              style={{ color: "#1a2a3a" }}
            >
              {warning.titel}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${color.badge}`}
            >
              {STUFE_LABEL[warning.stufe] ?? warning.stufe}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "#5a6a7a", lineHeight: 1.6 }}>
            {warning.beschreibung}
          </p>
          <div className="mt-2">
            <span
              className="inline-flex rounded-full bg-white/60 px-2 py-0.5 text-xs font-medium"
              style={{ color: color.icon }}
            >
              Experimentell · Keine amtliche Warnung
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
