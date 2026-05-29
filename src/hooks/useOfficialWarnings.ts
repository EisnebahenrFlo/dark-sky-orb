import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { buildOfficialWarningsFallback } from "@/lib/meteoFallbacks";

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
  areas: string[];
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

/**
 * Standalone fetcher (no WeatherContext dependency) — usable from
 * WeatherProvider itself to fuse warnings into the Hero code.
 */
export function useOfficialWarningsFor(
  lat: number | null,
  lon: number | null,
  country: string | undefined,
  enabled: boolean,
) {
  const [data, setData] = useState<OfficialWarningsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchWarnings = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled || lat == null || lon == null) return;
      setLoading(true);
      setError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/official-warnings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat, lon, country }),
          signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Amtliche Warnungen konnten nicht geladen werden");
        const payload = json as OfficialWarningsResponse;
        const filtered = (payload.warnings ?? []).filter((w) => {
          const isMeteoAlarm = typeof w.source === "string" && w.source.startsWith("MeteoAlarm");
          if (isMeteoAlarm && (w.level ?? 1) < 2) return false;
          return true;
        });
        setData({ ...payload, warnings: filtered });
        setLastUpdated(Date.now());
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setData(buildOfficialWarningsFallback(country));
        setLastUpdated(Date.now());
        setError(e?.message || "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    },
    [lat, lon, country, enabled],
  );

  useEffect(() => {
    ctrlRef.current?.abort();
    setData(null);
    setError(null);
    setLastUpdated(null);
    if (enabled) setLoading(true);
    loadedKeyRef.current = null;
  }, [lat, lon, enabled]);

  useEffect(() => {
    if (!enabled || lat == null || lon == null) return;
    const key = `${lat}_${lon}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    fetchWarnings(ctrl.signal);
    return () => ctrl.abort();
  }, [enabled, lat, lon, fetchWarnings]);

  useEffect(() => {
    if (!enabled) return;
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
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => { if (document.visibilityState === "visible") start(); else stop(); };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); stop(); };
  }, [enabled, fetchWarnings]);

  const refresh = useCallback(() => {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    return fetchWarnings(ctrl.signal);
  }, [fetchWarnings]);

  return { data, loading, error, refresh, lastUpdated };
}

export function useOfficialWarnings() {
  const { location } = useWeather();
  return useOfficialWarningsFor(
    location.latitude,
    location.longitude,
    location.country_code,
    !!location,
  );
}
