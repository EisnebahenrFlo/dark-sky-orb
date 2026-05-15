import { useQueries } from "@tanstack/react-query";

export interface FavoriteCurrent {
  temperature: number;
  weatherCode: number;
  isDay: number;
  precipitation: number;
  cloudCover: number;
}

async function fetchFavoriteCurrent(lat: number, lon: number): Promise<FavoriteCurrent> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day,precipitation,cloud_cover&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const c = json.current ?? {};
  return {
    temperature: c.temperature_2m,
    weatherCode: c.weather_code,
    isDay: c.is_day ?? 1,
    precipitation: c.precipitation ?? 0,
    cloudCover: c.cloud_cover ?? 0,
  };
}

/**
 * Fetches a lightweight current-weather snapshot for each favorite in parallel.
 * 15-min in-memory cache via React Query staleTime.
 */
export function useFavoriteWeather(items: { id: string; lat: number; lon: number }[]) {
  return useQueries({
    queries: items.map((it) => ({
      queryKey: ["favorite-current", it.id],
      queryFn: () => fetchFavoriteCurrent(it.lat, it.lon),
      staleTime: 15 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });
}
