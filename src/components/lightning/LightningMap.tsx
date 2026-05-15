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
import { Zap } from "lucide-react";

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
            style={{ height: "100%", width: "100%", background: "var(--muted)" }}
          >
            <TileLayer key={resolved} url={baseTile} attribution={baseAttr} maxZoom={10} />
            <Marker position={[location.latitude, location.longitude]} />
            {strikes.map((s, i) => (
              <StrikeMarker key={`${s.time}-${i}`} strike={s} now={now} />
            ))}
            <Recenter lat={location.latitude} lon={location.longitude} />
          </MapContainer>
        </div>

        {/* Counter (top-left) */}
        <div className="pointer-events-none absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur">
          <Zap className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
          <span className="tabular-nums">{strikesLast10Min}</span>
          <span className="text-muted-foreground">Blitze · 10 Min</span>
        </div>

        {/* Status (top-right) */}
        <div className="absolute right-3 top-3 z-[400]">
          <ConnectionStatus isConnected={isConnected} failed={failed} onRetry={reconnect} />
        </div>

        {/* Legend (bottom-right) */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-[400] rounded-2xl bg-background/85 px-3 py-2 text-[11px] shadow-sm backdrop-blur">
          <div className="mb-1 font-medium text-foreground">Alter</div>
          <div className="flex flex-col gap-1 text-muted-foreground">
            <LegendDot color="#fde047" label="< 5 s" />
            <LegendDot color="#fb923c" label="< 1 min" />
            <LegendDot color="#dc2626" label="< 10 min" />
            <LegendDot color="#7f1d1d" label="< 30 min" />
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
        Daten: <a href="https://www.blitzortung.org/" target="_blank" rel="noreferrer" className="underline hover:text-foreground">blitzortung.org</a>{" "}
        – Community-Netzwerk.{" "}
        <a
          href="https://www.blitzortung.org/de/contribute.php"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-foreground"
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
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
