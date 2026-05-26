import { useQueryClient } from "@tanstack/react-query";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { useSynoptikAnalysisCtx } from "@/contexts/SynoptikAnalysisContext";
import { useWeather } from "@/contexts/WeatherContext";
import { AnalysePage } from "@/pages/Analyse";
import { RefreshButton } from "@/components/RefreshButton";

export function AnalyseTabPage() {
  const { refresh: refreshOfficial } = useOfficialWarningsCtx();
  const { refresh: refreshSynoptik } = useSynoptikAnalysisCtx();
  const queryClient = useQueryClient();
  const { dataUpdatedAt } = useWeather();

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
      <AnalysePage />
    </div>
  );
}
