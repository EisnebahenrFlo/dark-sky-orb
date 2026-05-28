import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, CircleMarker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

import { useWeather } from "@/contexts/WeatherContext";
import { useTheme } from "@/hooks/useTheme";
import { useBlitzortungWS } from "@/hooks/useBlitzortungWS";
import { StrikeMarker } from "./StrikeMarker";
import { ConnectionStatus } from "./ConnectionStatus";
import { Zap, Locate, Plus, Minus, Layers } from "lucide-react";
import {
  clusterStrikes,
  findNearestStrike,
  type LightningCluster,
} from "@/lib/lightningCluster";

L.Marker.prototype.options.icon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

function MapControls({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  return (
    <div className="absolute right-3 bottom-20 z-[400] flex flex-col gap-1.5 sm:bottom-3 sm:top-auto">
      <div className="flex flex-col overflow-hidden rounded-2xl bg-background/90 shadow-sm ring-1 ring-border/60 backdrop-blur">
        <button
          onClick={() => map.zoomIn()}
          aria-label="Vergrößern"
          className="grid h-9 w-9 place-items-center text-foreground transition-colors hover:bg-muted/60"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
        <div className="h-px bg-border/60" />
        <button
          onClick={() => map.zoomOut()}
          aria-label="Verkleinern"
          className="grid h-9 w-9 place-items-center text-foreground transition-colors hover:bg-muted/60"
        >
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <button
        onClick={() => map.flyTo([lat, lon], 7, { duration: 0.8 })}
        aria-label="Auf Standort zentrieren"
        className="grid h-9 w-9 place-items-center rounded-2xl bg-background/90 text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur transition-colors hover:bg-muted/60"
      >
        <Locate className="h-4 w-4 text-primary" strokeWidth={2} />
      </button>
    </div>
  );
}

function ClusterMarker({ cluster }: { cluster: LightningCluster }) {
  // Visual emphasis grows with strike count, capped for sanity.
  const radius = Math.min(40, 12 + Math.sqrt(cluster.count) * 2);
  return (
    <>
      <Circle
        center={[cluster.lat, cluster.lon]}
        radius={radius * 1000}
        pathOptions={{
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: 0.08,
          weight: 1,
          dashArray: "4 4",
        }}
      />
      <CircleMarker
        center={[cluster.lat, cluster.lon]}
        radius={Math.min(18, 6 + Math.log2(cluster.count + 1) * 2)}
        pathOptions={{
          color: "#fbbf24",
          fillColor: "#f59e0b",
          fillOpacity: 0.35,
          weight: 1.5,
        }}
      />
    </>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h`;
}

export default function LightningMap() {
  const { location } = useWeather();
  const { resolved } = useTheme();
  const {
    strikes,
    isConnected,
    connectedCount,
    endpointCount,
    failed,
    strikesLast10Min,
    reconnect,
  } = useBlitzortungWS();

  const [showClusters, setShowClusters] = useState(true);

  // Re-render every second so marker ages animate
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const clusters = useMemo(
    () => (showClusters ? clusterStrikes(strikes, { minStrikes: 4 }) : []),
    // recompute when strike count changes; cheap enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strikes.length, showClusters],
  );

  const nearest = useMemo(
    () => findNearestStrike(strikes, location.latitude, location.longitude),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strikes.length, location.latitude, location.longitude],
  );

  const baseTile =
    resolved === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const baseAttr =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <div className="space-y-3">
      <div className="glass relative overflow-hidden rounded-3xl">
        <div className="h-[420px] w-full sm:h-[520px]">
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={6}
            maxZoom={10}
            scrollWheelZoom
            zoomControl={false}
            style={{ height: "100%", width: "100%", background: "var(--muted)" }}
          >
            <TileLayer key={resolved} url={baseTile} attribution={baseAttr} maxZoom={10} />
            <Marker position={[location.latitude, location.longitude]} />
            {clusters.map((c, i) => (
              <ClusterMarker key={`cl-${i}-${c.lat}-${c.lon}`} cluster={c} />
            ))}
            {strikes.map((s, i) => (
              <StrikeMarker key={`${s.time}-${i}`} strike={s} now={now} />
            ))}
            <Recenter lat={location.latitude} lon={location.longitude} />
            <MapControls lat={location.latitude} lon={location.longitude} />
          </MapContainer>
        </div>

        {/* Stats bar (top-left) */}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex max-w-[calc(100%-7rem)] flex-col gap-1.5">
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-border/60 backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-accent" strokeWidth={2.25} />
            <span className="tabular-nums text-foreground">{strikesLast10Min}</span>
            <span className="text-muted-foreground">· 10 Min</span>
            {clusters.length > 0 && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span className="tabular-nums text-foreground">{clusters.length}</span>
                <span className="text-muted-foreground">Hotspot{clusters.length === 1 ? "" : "s"}</span>
              </>
            )}
          </div>
          {nearest && nearest.distanceKm < 200 && (
            <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-background/90 px-3 py-1.5 text-[11px] shadow-sm ring-1 ring-amber-500/40 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="font-medium text-foreground">Nächster Blitz</span>
              <span className="tabular-nums text-foreground">
                {formatDistance(nearest.distanceKm)}
              </span>
              <span className="text-muted-foreground">{nearest.compass}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="tabular-nums text-muted-foreground">
                vor {formatAge(nearest.ageMs)}
              </span>
            </div>
          )}
        </div>

        {/* Status (top-right) */}
        <div className="absolute right-3 top-3 z-[400]">
          <ConnectionStatus
            isConnected={isConnected}
            connectedCount={connectedCount}
            endpointCount={endpointCount}
            failed={failed}
            onRetry={reconnect}
          />
        </div>

        {/* Layer toggle (bottom-right area, above zoom on mobile) */}
        <button
          onClick={() => setShowClusters((v) => !v)}
          aria-label="Hotspots umschalten"
          aria-pressed={showClusters}
          className={`absolute bottom-3 right-16 z-[400] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium shadow-sm ring-1 backdrop-blur transition-colors sm:right-14 ${
            showClusters
              ? "bg-amber-500/90 text-white ring-amber-500/40"
              : "bg-background/90 text-foreground ring-border/60 hover:bg-muted/60"
          }`}
        >
          <Layers className="h-3.5 w-3.5" strokeWidth={2} />
          Hotspots
        </button>

        {/* Legend (bottom-left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-2xl bg-background/90 px-3 py-2 text-[11px] shadow-sm ring-1 ring-border/60 backdrop-blur">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Alter
          </div>
          <div className="flex flex-col gap-1 text-foreground">
            <LegendDot color="#fde047" label="< 5 s" />
            <LegendDot color="#fb923c" label="< 1 min" />
            <LegendDot color="#dc2626" label="< 10 min" />
            <LegendDot color="#7f1d1d" label="< 30 min" />
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
        Daten:{" "}
        <a
          href="https://www.blitzortung.org/"
          target="_blank"
          rel="noreferrer"
          className="underline transition-colors hover:text-foreground"
        >
          blitzortung.org
        </a>{" "}
        – Community-Netzwerk, parallele Verbindung zu {endpointCount} Servern.{" "}
        <a
          href="https://www.blitzortung.org/de/contribute.php"
          target="_blank"
          rel="noreferrer"
          className="underline transition-colors hover:text-foreground"
        >
          Bitte unterstützen!
        </a>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border/40"
        style={{ background: color }}
      />
      <span className="tabular-nums">{label}</span>
    </div>
  );
}
