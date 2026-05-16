import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { useWeather } from "@/contexts/WeatherContext";

type Tone = { border: string; bg: string; text: string; label: string };

const TONES: Record<string, Tone> = {
  red: { border: "border-l-red-500", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", label: "Extrem" },
  orange: { border: "border-l-orange-500", bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", label: "Unwetter" },
  yellow: { border: "border-l-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", label: "Markant" },
  blue: { border: "border-l-blue-500", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", label: "Hinweis" },
};

function severityRank(stufe: string | undefined, level?: number): number {
  if (level) return level; // 1..4
  switch (stufe) {
    case "extrem": return 4;
    case "unwetter": return 3;
    case "markant": return 2;
    default: return 1;
  }
}

function rankToTone(rank: number): Tone {
  if (rank >= 4) return TONES.red;
  if (rank === 3) return TONES.orange;
  if (rank === 2) return TONES.yellow;
  return TONES.blue;
}

export function WarningIndicatorCard() {
  const { data: riskData } = useRiskWarningsCtx();
  const { data: officialData } = useOfficialWarningsCtx();
  const { location } = useWeather();

  const ki = riskData?.warnungen_12h ?? [];
  const official = officialData?.warnings ?? [];
  const total = ki.length + official.length;
  if (total === 0) return null;

  let maxRank = 0;
  for (const w of ki) maxRank = Math.max(maxRank, severityRank(w.stufe as string));
  for (const w of official) maxRank = Math.max(maxRank, severityRank(undefined, w.level));
  const tone = rankToTone(maxRank);

  return (
    <Link
      to="/warnungen"
      className={`group flex items-center gap-4 rounded-2xl border border-border ${tone.border} border-l-4 bg-card p-4 shadow-sm transition-colors hover:border-foreground/20 sm:p-5`}
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone.bg} ${tone.text}`}>
        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-semibold tracking-tight sm:text-lg">
          {total} {total === 1 ? "aktive Warnung" : "aktive Warnungen"} für {location.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`rounded-full ${tone.bg} ${tone.text} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}>
            Höchste Stufe: {tone.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
        Details
        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </div>
    </Link>
  );
}
