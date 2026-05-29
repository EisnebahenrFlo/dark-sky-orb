import { useCallback, useEffect, useRef, useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { useThunderstormRisk } from "@/hooks/useThunderstormRisk";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { useRainbowNowcast } from "@/hooks/useRainbowNowcast";
import { buildRiskWarningsFallback } from "@/lib/meteoFallbacks";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<RiskWarningsErrorCode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchIdRef = useRef<number>(0);
  const thunderstorm = useThunderstormRisk(48);
  const officialWarnings = useOfficialWarningsCtx();
  const nowcast = useRainbowNowcast();

  const fetchWarnings = useCallback(
    async () => {
      if (!weatherData || !location) return;
      const myId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
        const res = await fetch(`${baseUrl}/api/risk-warnings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weatherData: {
              latitude: weatherData.latitude,
              longitude: weatherData.longitude,
              current: weatherData.current,
              hourly: {
                time: weatherData.hourly.time,
                temperature_2m: weatherData.hourly.temperature_2m,
                precipitation: weatherData.hourly.precipitation,
                wind_gusts_10m: weatherData.hourly.wind_gusts_10m,
                wind_speed_10m: weatherData.hourly.wind_speed_10m,
                weather_code: weatherData.hourly.weather_code,
                cape: weatherData.hourly.cape,
                lifted_index: weatherData.hourly.lifted_index,
                convective_inhibition: weatherData.hourly.convective_inhibition,
                lightning_potential: weatherData.hourly.lightning_potential,
                snowfall: weatherData.hourly.snowfall,
              },
            },
            location,
            thunderstormScore: thunderstorm.current.score,
            windowHours: 48,
            officialWarnings: officialWarnings.data?.warnings ?? [],
            nowcast: nowcast.data ? {
              summary: nowcast.data.summary,
              forecast: nowcast.data.forecast.slice(0, 12),
            } : null,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (myId !== fetchIdRef.current) return; // stale
        if (!res.ok) {
          setErrorCode((json?.code as RiskWarningsErrorCode) || "API_ERROR");
          throw new Error(json?.error || "Warnungen konnten nicht geladen werden");
        }
        setData(json as RiskWarnings);
        setLastUpdated(Date.now());
      } catch (e: any) {
        if (myId !== fetchIdRef.current) return;
        setData(buildRiskWarningsFallback(weatherData, thunderstorm.current.score, officialWarnings.data?.warnings ?? []));
        setLastUpdated(Date.now());
        setErrorCode((prev) => prev ?? "NETWORK");
        setError(e?.message || "Unbekannter Fehler");
      } finally {
        if (myId === fetchIdRef.current) setLoading(false);
      }
    },
    [weatherData, location, thunderstorm.current.score, officialWarnings.data, nowcast.data],
  );

  // Drive fetches from location/weather changes
  useEffect(() => {
    if (!weatherData || !location) {
      setLoading(true);
      return;
    }
    if (weatherFetching) {
      setLoading(true);
      return;
    }
    if (
      Math.abs(weatherData.latitude - location.latitude) > 0.5 ||
      Math.abs(weatherData.longitude - location.longitude) > 0.5
    ) {
      setLoading(true);
      return;
    }
    fetchWarnings();
  }, [location, location.latitude, location.longitude, weatherData, weatherFetching, fetchWarnings]);

  // Auto-refresh every 15 min, pause when tab is hidden
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          fetchWarnings();
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
    return fetchWarnings();
  }, [fetchWarnings]);

  return { data, loading, error, errorCode, refresh, lastUpdated };
}
