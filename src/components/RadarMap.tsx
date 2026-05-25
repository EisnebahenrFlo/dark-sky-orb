import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

import { useWeather } from "@/contexts/WeatherContext";
import { useTheme } from "@/hooks/useTheme";
import { useInterval } from "@/hooks/useInterval";
import { fetchRainbow, frameTileUrl } from "@/lib/rainbow";
import { isDevEnvironment } from "@/lib/environment";
import { RadarControls } from "./RadarControls";
import { RadarLegend } from "./RadarLegend";

// Fix default marker icons in bundlers
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
    map.setView([lat, lon], 9);
  }, [lat, lon, map]);
  return null;
}

function InvalidateOnRefresh({ refreshKey }: { refreshKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (refreshKey === 0) return;
    map.invalidateSize();
  }, [refreshKey, map]);
  return null;
}

const FRAME_MS_FAST = 400;
const FRAME_MS_NEAR_NOW = 700;
const LOOP_RESET_PAUSE_MS = 1000;

export default function RadarMap({ refreshKey = 0 }: { refreshKey?: number }) {
  const { location } = useWeather();
  const { resolved } = useTheme();
  const isDev = isDevEnvironment();

  const { data, refetch } = useQuery({
    queryKey: ["rainbow"],
    queryFn: fetchRainbow,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (refreshKey === 0) return;
    refetch();
  }, [refreshKey, refetch]);

  const frames = useMemo(
    () => (data ? [...data.past, ...data.nowcast] : []),
    [data],
  );
  const pastCount = data?.past.length ?? 0;

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Default to last past frame ("now")
  useEffect(() => {
    if (frames.length && pastCount > 0) {
      setIndex(pastCount - 1);
    }
  }, [frames.length, pastCount]);

  const isAtLoopEnd = frames.length > 0 && index === frames.length - 1;
  const nearNow = pastCount > 0 && Math.abs(index - (pastCount - 1)) <= 2;
  const baseDelay = nearNow ? FRAME_MS_NEAR_NOW : FRAME_MS_FAST;
  useInterval(
    () => setIndex((i) => (frames.length ? (i + 1) % frames.length : 0)),
    isPlaying && frames.length ? (isAtLoopEnd ? baseDelay + LOOP_RESET_PAUSE_MS : baseDelay) : null,
  );

  const baseTile =
    resolved === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const baseAttr =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> &middot; Radar &copy; <a href="https://rainbow.ai">Rainbow.ai</a>';

  

  return (
    <div>
      <div className="glass relative overflow-hidden rounded-3xl">
        {isDev && (
          <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-full bg-yellow-400/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-yellow-950 shadow-md">
            DEV: Rainbow.ai Test
          </div>
        )}
        <div className="h-[420px] w-full sm:h-[520px]">
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={9}
            maxZoom={12}
            scrollWheelZoom
            style={{ height: "100%", width: "100%", background: "var(--muted)" }}
          >
            <TileLayer key={resolved} url={baseTile} attribution={baseAttr} maxZoom={12} />
            {data &&
              frames.map((f, i) => (
                <TileLayer
                  key={`${f.time}_${refreshKey}`}
                  url={`${frameTileUrl(data.snapshot, f)}&_v=${refreshKey}`}
                  opacity={i === index ? 0.85 : 0}
                  maxZoom={12}
                  zIndex={10 + i}
                />
              ))}
            <Marker position={[location.latitude, location.longitude]} />
            <Recenter lat={location.latitude} lon={location.longitude} />
            <InvalidateOnRefresh refreshKey={refreshKey} />
          </MapContainer>
        </div>
      </div>

      {frames.length > 0 && <RadarLegend />}

      {frames.length > 0 && (
        <RadarControls
          frames={frames}
          pastCount={pastCount}
          index={index}
          isPlaying={isPlaying}
          onToggle={() => {
            setIsPlaying((p) => {
              if (!p && index === frames.length - 1) setIndex(0);
              return !p;
            });
          }}
          onSeek={(i) => {
            setIsPlaying(false);
            setIndex(i);
          }}
        />
      )}
    </div>
  );
}
