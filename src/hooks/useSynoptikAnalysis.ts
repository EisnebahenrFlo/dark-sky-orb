import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { useThunderstormRisk } from "@/hooks/useThunderstormRisk";

export interface SynoptikAnalysis {
  highlight: { text: string };
  großwetterlage: { klassifikation: string; beschreibung: string };
  aktuell: { lage: string; luftmasse: string };
  konvektion: {
    potenzial: "kein" | "schwach" | "mäßig" | "hoch" | "extrem" | string;
    score: number;
    begründung: string;
    typ?: string;
    zeitraum?: string;
  };
  entwicklung: { next_24h: string; next_48h: string; trend_3_7d: string };
  regionale_besonderheiten: string[];
  großwetterlage_detail: {
    höhenstruktur: string;
    bodendruck: string;
    fronten?: string;
  };
  confidence: { score: number; begründung: string };
  // Legacy-Felder für Abwärtskompatibilität (alte Cache-Einträge)
  höhenstruktur_500hPa?: { muster: string; beschreibung: string };
  bodendruck?: { muster: string; beschreibung: string };
  luftmasse?: { klassifikation: string; begründung: string };
  fronten_aktivität?: { vorhanden: boolean; typ?: string; auswirkung?: string };
  jet_stream?: { relevant: boolean; beschreibung?: string };
  cached?: boolean;
  fromCache?: boolean;
  stale?: boolean;
  ageMinutes?: number;
  cacheAge?: number;
}

const HOURLY_KEYS = [
  "temperature_2m",
  "dewpoint_2m",
  "pressure_msl",
  "cape",
  "lifted_index",
  "convective_inhibition",
  "lightning_potential",
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
  const hours = 48;
  const hourly: Record<string, any> = { time: weatherData.hourly?.time?.slice(0, hours) ?? [] };
  for (const key of HOURLY_KEYS) {
    const arr = weatherData.hourly?.[key];
    if (Array.isArray(arr)) hourly[key] = arr.slice(0, hours);
  }
  if (weatherData.hourly?.pressure_msl) {
    hourly.pressure_msl = weatherData.hourly.pressure_msl.slice(0, hours);
  }
  return {
    latitude: weatherData.latitude,
    longitude: weatherData.longitude,
    timezone: weatherData.timezone,
    current: weatherData.current,
    hourly,
    daily: weatherData.daily,
  };
}

export type SynoptikErrorCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "INVALID_RESPONSE"
  | "BAD_REQUEST"
  | "NETWORK"
  | "UNKNOWN";

export function useSynoptikAnalysis() {
  const { data: weatherData, location, isFetching: weatherFetching } = useWeather();
  const thunderstorm = useThunderstormRisk(24);
  const [data, setData] = useState<SynoptikAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<SynoptikErrorCode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  const fetchAnalysis = useCallback(
    async (signal?: AbortSignal) => {
      if (!weatherData || !location) return;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const subset = buildSubset(weatherData);
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/synoptik`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weatherData: subset,
            location,
            thunderstormScore: thunderstorm.current.score,
          }),
          signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorCode((json?.code as SynoptikErrorCode) || "API_ERROR");
          throw new Error(json?.error || "Analyse fehlgeschlagen");
        }
        setData(json as SynoptikAnalysis);
        setLastUpdated(Date.now());
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setErrorCode((prev) => prev ?? "NETWORK");
        setError(e?.message || "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    },
    [weatherData, location, thunderstorm.current.score],
  );

  useEffect(() => {
    setData(null);
    setError(null);
    setErrorCode(null);
    setLastUpdated(null);
    setLoading(true);
    loadedKeyRef.current = null;
  }, [location.latitude, location.longitude]);

  useEffect(() => {
    if (!weatherData || !location) return;
    if (weatherFetching) return;
    if (
      Math.abs(weatherData.latitude - location.latitude) > 0.5 ||
      Math.abs(weatherData.longitude - location.longitude) > 0.5
    ) return;
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

  return { data, loading, error, errorCode, refresh, lastUpdated };
}
