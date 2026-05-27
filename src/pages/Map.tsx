import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Map as MapIcon, Radar, Zap } from "lucide-react";
import { useWeather } from "@/contexts/WeatherContext";
import { RefreshButton } from "@/components/RefreshButton";
import { LiveBadge } from "@/components/LiveBadge";
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
  const [lastRefresh, setLastRefresh] = useState<number>(() => Date.now());
  const { location } = useWeather();
  const queryClient = useQueryClient();
  useEffect(() => setMounted(true), []);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rainbow"] });
    setRefreshKey((k) => k + 1);
    setLastRefresh(Date.now());
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapIcon className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Wetterradar für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>

      <div className="mb-2 flex items-start justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-medium tracking-tight">Karte</h2>
            <LiveBadge />
          </div>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {tab === "radar" ? "Niederschlagsradar" : "Live-Blitze"}
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Kartenansicht"
          className="glass flex gap-0.5 rounded-full p-1 text-xs shadow-sm ring-1 ring-border/50"
        >
          {([
            { id: "radar", label: "Radar", Icon: Radar },
            { id: "lightning", label: "Blitze", Icon: Zap },
          ] as const).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  strokeWidth={active ? 2.5 : 2}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <RefreshButton variant="statusbar" onRefresh={handleRefresh} lastUpdated={lastRefresh} />

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
