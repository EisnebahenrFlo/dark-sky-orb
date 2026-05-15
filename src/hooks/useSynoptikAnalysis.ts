import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";

export interface SynoptikAnalysis {
  großwetterlage: { klassifikation: string; beschreibung: string };
  höhenstruktur_500hPa: { muster: string; beschreibung: string };
  bodendruck: { muster: string; beschreibung: string };
  luftmasse: { klassifikation: string; begründung: string };
  fronten_aktivität: { vorhanden: boolean; typ?: string; auswirkung?: string };
  konvektion: {
    potenzial: "kein" | "schwach" | "mäßig" | "hoch" | "extrem" | string;
    begründung: string;
    typ?: string;
    zeitraum?: string;
  };
  regionale_besonderheiten: string[];
  jet_stream: { relevant: boolean; beschreibung?: string };
  entwicklung: { next_24h: string; next_48h: string; trend_3_7d: string };
  confidence: { score: number; begründung: string };
  highlight: string;
  cached?: boolean;
  cacheAge?: number;
}

const HOURLY_KEYS = [
  "temperature_2m",
  "dewpoint_2m",
  "pressure_msl",
  "cape",
  "lifted_index",
  "convective_inhibition",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "temperature_850hPa",
  "temperature_500hPa",
  "geopotential_height_500hPa",
  "wind_speed_500hPa",
  "wind_speed_300hPa",
  "vertical_velocity_700hPa",
  "relative_humidity_850hPa",
] as const;

function buildSubset(weatherData: any) {
  const hours = 24;
  const hourly: Record<string, any> = { time: weatherData.hourly?.time?.slice(0, hours) ?? [] };
  for (const key of HOURLY_KEYS) {
    const arr = weatherData.hourly?.[key];
    if (Array.isArray(arr)) hourly[key] = arr.slice(0, hours);
  }
  // pressure_msl is only on current; surface only what exists
  if (weatherData.hourly?.pressure_msl) hourly.pressure_msl = weatherData.hourly.pressure_msl.slice(0, hours);

  return {
    latitude: weatherData.latitude,
    longitude: weatherData.longitude,
    timezone: weatherData.timezone,
    current: weatherData.current,
    hourly,
    daily: weatherData.daily,
  };
}

export function useSynoptikAnalysis() {
  const { data: weatherData, location, isFetching: weatherFetching } = useWeather();
  const [data, setData] = useState<SynoptikAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const fetchAnalysis = useCallback(
    async (signal?: AbortSignal) => {
      if (!weatherData || !location) return;
      setLoading(true);
      setError(null);
      try {
        const subset = buildSubset(weatherData);
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/synoptik`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weatherData: subset, location }),
          signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Analyse fehlgeschlagen");
        setData(json as SynoptikAnalysis);
        setLastUpdated(Date.now());
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    },
    [weatherData, location],
  );

  // Clear stale analysis immediately when location changes
  useEffect(() => {
    setData(null);
    setError(null);
    setLastUpdated(null);
    setLoading(true);
    loadedKeyRef.current = null;
  }, [location.latitude, location.longitude]);

  // Fetch only when fresh weather data for the current location is available
  useEffect(() => {
    if (!weatherData || !location) return;
    if (weatherFetching) return;
    // Coordinate match: weatherData must belong to current location
    if (
      Math.abs(weatherData.latitude - location.latitude) > 0.5 ||
      Math.abs(weatherData.longitude - location.longitude) > 0.5
    ) {
      return;
    }
    const key = `${location.latitude}_${location.longitude}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    const ctrl = new AbortController();
    fetchAnalysis(ctrl.signal);
    return () => ctrl.abort();
  }, [
    location.latitude,
    location.longitude,
    weatherData?.latitude,
    weatherData?.longitude,
    weatherFetching,
    fetchAnalysis,
  ]);

  const refresh = useCallback(() => fetchAnalysis(), [fetchAnalysis]);

  return { data, loading, error, refresh, lastUpdated };
}
