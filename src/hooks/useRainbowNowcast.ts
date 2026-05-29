import { useQuery } from "@tanstack/react-query";
import { useWeather } from "@/contexts/WeatherContext";
import { fetchRainbowNowcastFallback } from "@/lib/meteoFallbacks";

export type RainbowPrecipType = "rain" | "snow" | "ice" | "none" | "no_precipitation";

export interface RainbowNowcastItem {
  precipRate: number;
  precipType: RainbowPrecipType;
  timestampBegin: number;
  timestampEnd: number;
}

export interface RainbowNowcastResponse {
  forecast: RainbowNowcastItem[];
  latitude: number;
  longitude: number;
  summary: {
    intensity: "none" | "light" | "moderate" | "heavy" | "extreme";
  };
}

const TEN_MIN = 10 * 60 * 1000;

/**
 * Standalone fetcher that does not depend on WeatherContext — used by
 * WeatherProvider itself to avoid a hook cycle.
 */
export function useRainbowNowcastFor(lat: number | null, lon: number | null, enabled: boolean) {
  const query = useQuery<RainbowNowcastResponse>({
    queryKey: ["rainbow-nowcast", lat, lon],
    queryFn: async () => {
      try {
        const res = await fetch(
          `/api/rainbow-nowcast?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
        );
        if (res.ok) return (await res.json()) as RainbowNowcastResponse;
      } catch {
        // Preview/API unavailable → Open-Meteo minutely fallback.
      }
      return (await fetchRainbowNowcastFallback(Number(lat), Number(lon))) as RainbowNowcastResponse;
    },
    staleTime: TEN_MIN,
    refetchInterval: TEN_MIN,
    refetchOnWindowFocus: false,
    enabled: enabled && lat != null && lon != null,
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh: () => {
      query.refetch();
    },
  };
}

export function useRainbowNowcast() {
  const { location } = useWeather();
  return useRainbowNowcastFor(location.latitude, location.longitude, true);
}
