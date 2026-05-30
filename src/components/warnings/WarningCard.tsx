import {
  AlertTriangle,
  CloudHail,
  CloudRain,
  Snowflake,
  Sparkles,
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
  CloudHail,
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

const TONE: Record<ColorKey, { strip: string; accent: string; tint: string; ring: string }> = {
  green: {
    strip: "bg-emerald-500",
    accent: "text-emerald-600 dark:text-emerald-400",
    tint: "from-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  yellow: {
    strip: "bg-amber-500",
    accent: "text-amber-600 dark:text-amber-400",
    tint: "from-amber-500/10",
    ring: "ring-amber-500/20",
  },
  orange: {
    strip: "bg-orange-500",
    accent: "text-orange-600 dark:text-orange-400",
    tint: "from-orange-500/10",
    ring: "ring-orange-500/25",
  },
  red: {
    strip: "bg-red-500",
    accent: "text-red-600 dark:text-red-400",
    tint: "from-red-500/15",
    ring: "ring-red-500/30",
  },
  purple: {
    strip: "bg-purple-500",
    accent: "text-purple-600 dark:text-purple-400",
    tint: "from-purple-500/10",
    ring: "ring-purple-500/20",
  },
};

function resolveColor(c: string): ColorKey {
  return (c in TONE ? c : "yellow") as ColorKey;
}

export function WarningCard({ warning }: { warning: RiskWarning }) {
  const Icon = ICONS[warning.icon] ?? AlertTriangle;
  const tone = TONE[resolveColor(warning.color)];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.tint} via-transparent to-transparent`}
        aria-hidden
      />
      <div className={`absolute left-0 top-0 h-full w-1 ${tone.strip}`} aria-hidden />

      <div className="relative p-4 pl-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5">
            <Sparkles className={`h-3 w-3 ${tone.accent}`} strokeWidth={2} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${tone.accent}`}>
              KI-Wetterhinweis · Experimentell
            </span>
          </div>
          <span
            className={`shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${tone.ring} ${tone.accent}`}
          >
            {STUFE_LABEL[warning.stufe] ?? warning.stufe}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-background/70 ring-1 ${tone.ring}`}>
            <Icon className={`h-4.5 w-4.5 ${tone.accent}`} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold leading-tight text-foreground">
              {warning.titel}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {warning.beschreibung}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-border/60 pt-2">
          <span className="text-[10px] italic text-muted-foreground/80">
            Keine amtliche Warnung · dient als Ergänzung
          </span>
        </div>
      </div>
    </div>
  );
}
