import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
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
import { Zap, Locate, Plus, Minus } from "lucide-react";

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

export default function LightningMap() {
  const { location } = useWeather();
  const { resolved } = useTheme();
  const { strikes, isConnected, failed, strikesLast10Min, reconnect } = useBlitzortungWS();

  // Re-render every second so marker ages animate
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
            {strikes.map((s, i) => (
              <StrikeMarker key={`${s.time}-${i}`} strike={s} now={now} />
            ))}
            <Recenter lat={location.latitude} lon={location.longitude} />
            <MapControls lat={location.latitude} lon={location.longitude} />
          </MapContainer>
        </div>

        {/* Counter (top-left) */}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-border/60 backdrop-blur">
          <Zap className="h-3.5 w-3.5 text-accent" strokeWidth={2.25} />
          <span className="tabular-nums text-foreground">{strikesLast10Min}</span>
          <span className="text-muted-foreground">· 10 Min</span>
        </div>

        {/* Status (top-right) */}
        <div className="absolute right-3 top-3 z-[400]">
          <ConnectionStatus isConnected={isConnected} failed={failed} onRetry={reconnect} />
        </div>

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
        – Community-Netzwerk.{" "}
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
