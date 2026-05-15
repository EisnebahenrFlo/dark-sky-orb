import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";

export type OfficialWarningType =
  | "wind"
  | "rain"
  | "thunderstorm"
  | "snow"
  | "ice"
  | "glaze"
  | "heat"
  | "cold"
  | "fog"
  | "flood"
  | "avalanche"
  | "thaw"
  | "snow_drift"
  | "extreme"
  | "uv"
  | "other";

export type OfficialWarningLevel = 1 | 2 | 3 | 4;

export interface OfficialWarning {
  id: string;
  source: string;
  type: OfficialWarningType;
  level: OfficialWarningLevel;
  title: string;
  description: string;
  area: string;
  start: string;
  end: string;
  url?: string;
}

export interface OfficialWarningsResponse {
  warnings: OfficialWarning[];
  sources: string[];
  country: string;
  disclaimer: string;
  cached: boolean;
}

const REFRESH_MS = 15 * 60 * 1000;

export function useOfficialWarnings() {
  const { location } = useWeather();
  const [data, setData] = useState<OfficialWarningsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchWarnings = useCallback(
    async (signal?: AbortSignal) => {
      if (!location) return;
      setLoading(true);
      setError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/official-warnings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: location.latitude,
            lon: location.longitude,
            country: location.country_code,
          }),
          signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Amtliche Warnungen konnten nicht geladen werden");
        setData(json as OfficialWarningsResponse);
        setLastUpdated(Date.now());
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    },
    [location],
  );

  // Reset on location change
  useEffect(() => {
    ctrlRef.current?.abort();
    setData(null);
    setError(null);
    setLastUpdated(null);
    setLoading(true);
    loadedKeyRef.current = null;
  }, [location.latitude, location.longitude]);

  // Initial load per location
  useEffect(() => {
    if (!location) return;
    const key = `${location.latitude}_${location.longitude}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    fetchWarnings(ctrl.signal);
    return () => ctrl.abort();
  }, [location.latitude, location.longitude, fetchWarnings]);

  // Auto refresh
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          const ctrl = new AbortController();
          ctrlRef.current = ctrl;
          fetchWarnings(ctrl.signal);
        }
      }, REFRESH_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, [fetchWarnings]);

  const refresh = useCallback(() => {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return fetchWarnings(ctrl.signal);
  }, [fetchWarnings]);

  return { data, loading, error, refresh, lastUpdated };
}
