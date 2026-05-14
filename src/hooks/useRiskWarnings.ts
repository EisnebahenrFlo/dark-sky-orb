import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";

export type RiskColor = "green" | "yellow" | "orange" | "red" | "purple";
export type RiskLevel = "kein" | "schwach" | "mäßig" | "hoch" | "sehr_hoch" | "extrem";
export type WarnStufe = "markant" | "unwetter" | "extrem";
export type WarnIcon = "Wind" | "CloudRain" | "Zap" | "Snowflake" | "Thermometer" | "AlertTriangle";

export interface RiskWarning {
  id: string;
  typ: string;
  stufe: WarnStufe | string;
  titel: string;
  beschreibung: string;
  color: RiskColor | string;
  icon: WarnIcon | string;
}

export interface RiskWarnings {
  gewitter_risiko_6h: {
    level: RiskLevel | string;
    score: number;
    begründung: string;
    zeitfenster?: string;
    konvektionstyp?: string;
    color: RiskColor | string;
  };
  warnungen_12h: RiskWarning[];
  summary: string;
  disclaimer: string;
  cached?: boolean;
}

const REFRESH_MS = 15 * 60 * 1000;

export function useRiskWarnings() {
  const { data: weatherData, location } = useWeather();
  const [data, setData] = useState<RiskWarnings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const fetchWarnings = useCallback(
    async (signal?: AbortSignal) => {
      if (!weatherData || !location) return;
      setLoading(true);
      setError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/risk-warnings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weatherData, location }),
          signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Warnungen konnten nicht geladen werden");
        setData(json as RiskWarnings);
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

  // Initial load when weather/location available or location changes
  useEffect(() => {
    if (!weatherData || !location) return;
    const key = `${location.latitude}_${location.longitude}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    fetchWarnings(ctrl.signal);
    return () => ctrl.abort();
  }, [weatherData, location, fetchWarnings]);

  // Auto-refresh every 15 min, pause when tab is hidden
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
