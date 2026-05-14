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
  const [isPlaying, setIsPlaying] = useState(false);

  // Default to last past frame ("now")
  useEffect(() => {
    if (frames.length && pastCount > 0) {
      setIndex(pastCount - 1);
    }
  }, [frames.length, pastCount]);

  useInterval(
    () => setIndex((i) => (frames.length ? (i + 1) % frames.length : 0)),
    isPlaying && frames.length ? FRAME_MS : null,
  );

  const baseTile =
    resolved === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  const baseAttr =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

  return (
    <div>
      <div className="glass overflow-hidden rounded-3xl">
        <div className="h-[420px] w-full sm:h-[520px]">
          <MapContainer
            center={[location.latitude, location.longitude]}
            zoom={8}
            scrollWheelZoom
            style={{ height: "100%", width: "100%", background: "var(--muted)" }}
          >
            <TileLayer url={baseTile} attribution={baseAttr} />
            {frames.map((f, i) => (
              <TileLayer
                key={f.path}
                url={frameTileUrl(data!.host, f)}
                opacity={i === index ? 0.7 : 0}
                zIndex={10}
              />
            ))}
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
          onToggle={() => setIsPlaying((p) => !p)}
          onSeek={(i) => {
            setIsPlaying(false);
            setIndex(i);
          }}
        />
      )}
    </div>
  );
}
