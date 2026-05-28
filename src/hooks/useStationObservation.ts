import { useQuery } from "@tanstack/react-query";

export interface StationObservation {
  temperature: number | null;
  apparentTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  pressure: number | null;
  precipitation10min: number | null;
  weatherCode: number | null;
  cloudCover: number | null;
  visibility: number | null;
  observedAt: string;
  stationName: string;
  stationDistanceKm: number;
  source: "brightsky" | "metar";
}

const FIVE_MIN = 5 * 60 * 1000;

export function useStationObservation(
  lat: number,
  lon: number,
  countryCode?: string,
  enabled: boolean = true,
) {
  const query = useQuery<{ observation: StationObservation | null }>({
    queryKey: ["station", lat, lon, countryCode],
    queryFn: async () => {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
      });
      if (countryCode) params.set("country", countryCode);
      const res = await fetch(`/api/station?${params}`);
      if (!res.ok) return { observation: null };
      return res.json();
    },
    staleTime: FIVE_MIN,
    refetchInterval: FIVE_MIN,
    refetchOnWindowFocus: false,
    enabled: enabled && Number.isFinite(lat) && Number.isFinite(lon),
    retry: 1,
  });

  return {
    observation: query.data?.observation ?? null,
    isLoading: query.isLoading,
  };
}
