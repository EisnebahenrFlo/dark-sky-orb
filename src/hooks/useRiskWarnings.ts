import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { useThunderstormRisk } from "@/hooks/useThunderstormRisk";
import { useOfficialWarnings } from "@/hooks/useOfficialWarnings";
import { useRainbowNowcast } from "@/hooks/useRainbowNowcast";

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
  fromCache?: boolean;
  stale?: boolean;
  ageMinutes?: number;
}

export type RiskWarningsErrorCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "INVALID_RESPONSE"
  | "BAD_REQUEST"
  | "NETWORK"
  | "UNKNOWN";

const REFRESH_MS = 15 * 60 * 1000;

export function useRiskWarnings() {
  const { data: weatherData, location, isFetching: weatherFetching } = useWeather();
  const [data, setData] = useState<RiskWarnings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<RiskWarningsErrorCode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const thunderstorm = useThunderstormRisk(48);

  const fetchWarnings = useCallback(
    async (signal?: AbortSignal) => {
      if (!weatherData || !location) return;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/risk-warnings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weatherData,
            location,
            thunderstormScore: thunderstorm.current.score,
            windowHours: 48,
          }),
          signal,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorCode((json?.code as RiskWarningsErrorCode) || "API_ERROR");
          throw new Error(json?.error || "Warnungen konnten nicht geladen werden");
        }
        setData(json as RiskWarnings);
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

  // Clear stale warnings immediately when location changes
  useEffect(() => {
    ctrlRef.current?.abort();
    setData(null);
    setError(null);
    setErrorCode(null);
    setLastUpdated(null);
    setLoading(true);
    loadedKeyRef.current = null;
  }, [location.latitude, location.longitude]);

  // Fetch only when fresh weather data for the current location is available
  useEffect(() => {
    if (!weatherData || !location) return;
    if (weatherFetching) return;
    if (
      Math.abs(weatherData.latitude - location.latitude) > 0.5 ||
      Math.abs(weatherData.longitude - location.longitude) > 0.5
    ) {
      return;
    }
    const key = `${location.latitude}_${location.longitude}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    fetchWarnings(ctrl.signal);
    return () => ctrl.abort();
  }, [
    location.latitude,
    location.longitude,
    weatherData?.latitude,
    weatherData?.longitude,
    weatherFetching,
    fetchWarnings,
  ]);

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

  return { data, loading, error, errorCode, refresh, lastUpdated };
}
