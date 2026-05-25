import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Map as MapIcon } from "lucide-react";
import { useWeather } from "@/contexts/WeatherContext";
import { RefreshButton } from "@/components/RefreshButton";
const RadarMap = lazy(() => import("@/components/RadarMap"));
const LightningMap = lazy(() => import("@/components/lightning/LightningMap"));



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
  const [refreshKey, setRefreshKey] = useState(0);
  const { location } = useWeather();
  const queryClient = useQueryClient();
  useEffect(() => setMounted(true), []);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rainbow"] });
    setRefreshKey((k) => k + 1);
  };

  return (
    <section className="relative space-y-4">
      <div className="absolute right-0 top-0 z-20">
        <RefreshButton onRefresh={handleRefresh} />
      </div>
      <div className="flex items-center gap-2 pr-14 text-sm text-muted-foreground">
        <MapIcon className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Wetterradar für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>

      <div className="mb-4 flex items-start justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-medium tracking-tight">Karte</h2>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {tab === "radar" ? "Niederschlagsradar" : "Live-Blitze"}
          </span>
        </div>
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
        mounted ? (
          <Suspense fallback={<MapFallback />}>
            <RadarMap refreshKey={refreshKey} />
          </Suspense>
        ) : (
          <MapFallback />
        )
      ) : mounted ? (
        <Suspense fallback={<MapFallback />}>
          <LightningMap />
        </Suspense>
      ) : (
        <MapFallback />
      )}
    </section>
  );
}
