import { useQueryClient } from "@tanstack/react-query";
import { CurrentPage } from "@/pages/Current";
import { NowcastPage } from "@/pages/Nowcast";
import { PageState } from "@/components/PageState";
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

  // Zentraler Loading/Error-State für die Home-Seite — verhindert doppelte
  // Loader-Karten von CurrentPage und NowcastPage beim ersten Laden.
  return (
    <PageState>
      {() => (
        <div className="space-y-8">
          <CurrentPage onRefresh={handleRefresh} />
          <section id="nowcast" className="scroll-mt-24">
            <NowcastPage />
          </section>
        </div>
      )}
    </PageState>
  );
}
