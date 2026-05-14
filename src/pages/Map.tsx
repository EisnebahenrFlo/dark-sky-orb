import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { LightningEmbed } from "@/components/LightningEmbed";

const RadarMap = lazy(() => import("@/components/RadarMap"));

type SubTab = "radar" | "lightning";

function MapFallback() {
  return (
    <div className="glass grid h-[420px] place-items-center rounded-3xl sm:h-[520px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function MapPage() {
  const [tab, setTab] = useState<SubTab>("radar");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeader title="Karte" subtitle={tab === "radar" ? "Niederschlagsradar" : "Live-Blitze"} />
        <div className="glass flex gap-0.5 rounded-full p-0.5 text-xs">
          {(["radar", "lightning"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "radar" ? "Radar" : "Blitze"}
            </button>
          ))}
        </div>
      </div>

      {tab === "radar" ? (
        <Suspense fallback={<MapFallback />}>
          <RadarMap />
        </Suspense>
      ) : (
        <LightningEmbed />
      )}
    </section>
  );
}
