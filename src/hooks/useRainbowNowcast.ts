import { useQuery } from "@tanstack/react-query";
import { useWeather } from "@/contexts/WeatherContext";

export interface RainbowNowcastItem {
  precipRate: number;
  precipType: "rain" | "snow" | "ice" | "none";
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

export function useRainbowNowcast() {
  const { location } = useWeather();
  const lat = location.latitude;
  const lon = location.longitude;

  const query = useQuery<RainbowNowcastResponse>({
    queryKey: ["rainbow-nowcast", lat, lon],
    queryFn: async () => {
      const res = await fetch(
        `/api/rainbow-nowcast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      );
      if (!res.ok) throw new Error("Nowcast nicht verfügbar");
      return (await res.json()) as RainbowNowcastResponse;
    },
    staleTime: TEN_MIN,
    refetchInterval: TEN_MIN,
    refetchOnWindowFocus: false,
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
