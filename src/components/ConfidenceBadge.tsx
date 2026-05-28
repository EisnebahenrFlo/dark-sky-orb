import { Activity } from "lucide-react";
import { confidenceLabel, confidenceLevel } from "@/lib/modelEnsemble";

interface Props {
  score: number;
  models?: string[];
  spreadTemp?: number;
  spreadPop?: number;
  size?: "sm" | "md" | "lg";
  /** When true, hide on high-confidence to reduce visual noise. */
  hideHigh?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR: Record<"high" | "medium" | "low", { bg: string; fg: string; dot: string }> = {
  high:   { bg: "rgba(16,185,129,0.12)",  fg: "rgb(16,185,129)",  dot: "bg-emerald-400" },
  medium: { bg: "rgba(251,191,36,0.14)",  fg: "rgb(245,158,11)",  dot: "bg-amber-400" },
  low:    { bg: "rgba(239,68,68,0.14)",   fg: "rgb(239,68,68)",   dot: "bg-red-400" },
};

const MODEL_LABEL: Record<string, string> = {
  icon_d2: "ICON-D2",
  icon_ch2: "ICON-CH2",
  meteoswiss_icon_ch2: "ICON-CH2",
  meteoswiss_icon_ch1: "ICON-CH1",
  icon_eu: "ICON-EU",
  italia_meteo_arpae_icon_2i: "ARPAE-ICON-2i",
  ecmwf_ifs025: "ECMWF IFS",
  knmi_harmonie_arome_europe: "KNMI Harmonie",
  icon_seamless: "ICON Seamless",
  gfs_seamless: "GFS",
  best_match: "Best Match",
};

export function ConfidenceBadge({
  score,
  models,
  spreadTemp,
  spreadPop,
  size = "md",
  hideHigh = false,
  className = "",
  style,
}: Props) {
  const lvl = confidenceLevel(score);
  if (hideHigh && lvl === "high") return null;
  const c = COLOR[lvl];
  const sizeCls =
    size === "sm" ? "text-[10px] gap-1 px-1.5 py-0.5" : size === "lg" ? "text-sm gap-2 px-3 py-1.5" : "text-xs gap-1.5 px-2 py-1";

  const modelList = models?.map((m) => MODEL_LABEL[m] ?? m).join(", ");
  const tip = [
    `${confidenceLabel(score)} · ${score}%`,
    modelList ? `Modelle: ${modelList}` : null,
    spreadTemp != null ? `Temp-Spread: ±${spreadTemp.toFixed(1)} K` : null,
    spreadPop != null && spreadPop > 0 ? `PoP-Spread: ${Math.round(spreadPop)} %` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium tabular-nums ${sizeCls} ${className}`}
      style={{ backgroundColor: c.bg, color: c.fg, ...style }}
      title={tip}
    >
      <Activity size={size === "sm" ? 10 : size === "lg" ? 14 : 12} strokeWidth={2} />
      <span>{score}%</span>
    </span>
  );
}

/** Compact dot indicator for dense lists (hourly rows). */
export function ConfidenceDot({ score, title }: { score: number; title?: string }) {
  const lvl = confidenceLevel(score);
  const c = COLOR[lvl];
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${c.dot}`}
      title={title ?? `${confidenceLabel(score)} · ${score}%`}
      aria-label={`Konfidenz ${score}%`}
    />
  );
}
