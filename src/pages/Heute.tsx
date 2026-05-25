import { useQueryClient } from "@tanstack/react-query";
import { CurrentPage } from "@/pages/Current";
import { NowcastPage } from "@/pages/Nowcast";
import { RefreshButton } from "@/components/RefreshButton";
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";

export function HeutePage() {
  const queryClient = useQueryClient();
  const { refresh: refreshRisk } = useRiskWarningsCtx();
  const { refresh: refreshOfficial } = useOfficialWarningsCtx();

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["weather"] }),
      Promise.resolve(refreshRisk()),
      Promise.resolve(refreshOfficial()),
    ]);
  };

  return (
    <div className="relative space-y-8">
      <div className="absolute right-0 top-0 z-20">
        <RefreshButton onRefresh={handleRefresh} />
      </div>
      <CurrentPage />
      <NowcastPage />
    </div>
  );
}
