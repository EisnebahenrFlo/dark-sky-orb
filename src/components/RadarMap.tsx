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
import { fetchRainViewer, frameTileUrl } from "@/lib/rainviewer";
import { RadarControls } from "./RadarControls";

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
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

const FRAME_MS = 500;
const LOOP_RESET_PAUSE_MS = 1000;

export default function RadarMap() {
  const { location } = useWeather();
  const { resolved } = useTheme();

  const { data } = useQuery({
    queryKey: ["rainviewer"],
    queryFn: fetchRainViewer,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

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

  // Use a longer pause when we just wrapped from the last frame back to the first.
  const isAtLoopEnd = frames.length > 0 && index === frames.length - 1;
  useInterval(
    () => setIndex((i) => (frames.length ? (i + 1) % frames.length : 0)),
    isPlaying && frames.length ? (isAtLoopEnd ? FRAME_MS + LOOP_RESET_PAUSE_MS : FRAME_MS) : null,
  );

  const baseTile =
    resolved === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const baseAttr =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  const currentFrame = frames[index];

  return (
    <div>
      <div className="glass overflow-hidden rounded-3xl">
        <div className="h-[420px] w-full sm:h-[520px]">
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={7}
            maxZoom={10}
            scrollWheelZoom
            style={{ height: "100%", width: "100%", background: "var(--muted)" }}
          >
            <TileLayer key={resolved} url={baseTile} attribution={baseAttr} maxZoom={10} />
            {currentFrame && data && (
              <TileLayer
                key={currentFrame.path}
                url={frameTileUrl(data.host, currentFrame)}
                opacity={0.85}
                maxZoom={10}
                zIndex={10}
              />
            )}
            <Marker position={[location.latitude, location.longitude]} />
            <Recenter lat={location.latitude} lon={location.longitude} />
          </MapContainer>
        </div>
      </div>

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
