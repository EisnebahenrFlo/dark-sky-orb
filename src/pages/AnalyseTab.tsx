import { useQueryClient } from "@tanstack/react-query";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { useSynoptikAnalysisCtx } from "@/contexts/SynoptikAnalysisContext";
import { useWeather } from "@/contexts/WeatherContext";
import { OfficialWarningCard } from "@/components/warnings/OfficialWarningCard";
import { AnalysePage } from "@/pages/Analyse";
import { RefreshButton } from "@/components/RefreshButton";

function SectionHeaderDot({ title, active }: { title: string; active: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2 px-1">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: active ? "#ff9500" : "#22c55e" }}
      />
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
    </div>
  );
}

function CalmShield() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 dark:bg-card">
      <svg width="36" height="36" viewBox="0 0 52 52" aria-hidden>
        <defs>
          <linearGradient id="calmShieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        <path
          d="M26 6 L42 12.5 L42 26 C42 36 35 43.5 26 46.5 C17 43.5 10 36 10 26 L10 12.5 Z"
          fill="none"
          stroke="url(#calmShieldGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polyline
          points="18,26 23,31 34,20"
          fill="none"
          stroke="url(#calmShieldGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <div className="text-xs font-bold text-[#1a2a3a] dark:text-foreground">Alles ruhig</div>
        <div className="mt-px text-[9.5px] leading-snug text-[#8a9ab0] dark:text-muted-foreground">
          Keine aktiven amtlichen Warnungen
        </div>
      </div>
    </div>
  );
}

export function AnalyseTabPage() {
  const { data: officialData, refresh: refreshOfficial } = useOfficialWarningsCtx();
  const { refresh: refreshSynoptik } = useSynoptikAnalysisCtx();
  const queryClient = useQueryClient();
  const { dataUpdatedAt } = useWeather();
  const official = officialData?.warnings ?? [];
  const sorted = [...official].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const hasOfficial = sorted.length > 0;

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["weather"] }),
      Promise.resolve(refreshOfficial()),
      Promise.resolve(refreshSynoptik()),
    ]);
  };

  return (
    <div className="space-y-6">
      <RefreshButton variant="statusbar" onRefresh={handleRefresh} lastUpdated={dataUpdatedAt} />
      <section>
        <SectionHeaderDot title="Amtliche Warnungen" active={hasOfficial} />
        {hasOfficial ? (
          <div className="space-y-3">
            {sorted.map((w) => (
              <OfficialWarningCard key={w.id} warning={w} />
            ))}
          </div>
        ) : (
          <CalmShield />
        )}
      </section>

      <div className="border-t border-border/60" />

      <section>
        <SectionHeaderDot title="KI-Analyse" active={false} />
        <AnalysePage />
      </section>
    </div>
  );
}
