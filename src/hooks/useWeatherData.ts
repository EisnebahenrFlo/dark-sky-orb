import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchWeather, type WeatherData } from "@/lib/weather";

const REFRESH_MS = 5 * 60 * 1000;

export type WeatherErrorCode = "unsupported_location" | null;

export interface UseWeatherDataResult {
  data: WeatherData | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  errorCode: WeatherErrorCode;
  dataUpdatedAt: number;
  refresh: () => Promise<unknown>;
}

export function useWeatherData(lat: number, lon: number): UseWeatherDataResult {
  const query = useQuery({
    queryKey: ["weather", lat, lon],
    queryFn: () => fetchWeather(lat, lon),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { refetch, isError, error, data } = query;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-refresh every 5min, paused while tab is hidden
  useEffect(() => {
    const start = () => {
      stop();
      intervalRef.current = setInterval(() => {
        if (!document.hidden) refetch();
      }, REFRESH_MS);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        refetch();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch, lat, lon]);

  // Toast on error, but keep stale data visible
  const lastErrorRef = useRef<unknown>(null);
  useEffect(() => {
    if (isError && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      toast.error("Konnte Daten nicht laden", {
        description: "Nächster Versuch in 5 Min.",
        action: { label: "Erneut", onClick: () => refetch() },
      });
    }
    if (!isError) lastErrorRef.current = null;
  }, [isError, error, refetch]);

  // Detect locations where Open-Meteo only returns `current` (no hourly/daily).
  const unsupported = !!data && (!data.hourly || !data.daily || !data.minutely_15);
  const errorCode: WeatherErrorCode = unsupported ? "unsupported_location" : null;

  return {
    data: unsupported ? undefined : data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: isError || unsupported,
    error,
    errorCode,
    dataUpdatedAt: query.dataUpdatedAt,
    refresh: refetch,
  };
}
