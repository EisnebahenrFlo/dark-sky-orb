import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CloudOff } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { WeatherHero } from "@/components/WeatherHero";
import { fetchWeather, type GeoResult } from "@/lib/weather";

export const Route = createFileRoute("/")({ component: Index });

const RECENT_KEY = "weather:recent";
const SELECTED_KEY = "weather:selected";

const DEFAULT: GeoResult = {
  id: 2950159, name: "Berlin", latitude: 52.52, longitude: 13.405,
  country: "Deutschland", country_code: "DE", admin1: "Berlin",
};

function loadRecent(): GeoResult[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function loadSelected(): GeoResult {
  if (typeof window === "undefined") return DEFAULT;
  try { return JSON.parse(localStorage.getItem(SELECTED_KEY) ?? "null") ?? DEFAULT; } catch { return DEFAULT; }
}

function Index() {
  const [location, setLocation] = useState<GeoResult>(DEFAULT);
  const [recent, setRecent] = useState<GeoResult[]>([]);

  useEffect(() => {
    setLocation(loadSelected());
    setRecent(loadRecent());
  }, []);

  const handleSelect = (loc: GeoResult) => {
    setLocation(loc);
    localStorage.setItem(SELECTED_KEY, JSON.stringify(loc));
    const next = [loc, ...recent.filter((r) => r.id !== loc.id)].slice(0, 6);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const clearRecent = () => {
    setRecent([]);
    localStorage.removeItem(RECENT_KEY);
  };

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["weather", location.latitude, location.longitude],
    queryFn: () => fetchWeather(location.latitude, location.longitude),
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          <span className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">Meteo</span>
        </div>
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      <div className="mb-8">
        <SearchBar onSelect={handleSelect} recent={recent} onClearRecent={clearRecent} />
      </div>

      {isLoading && (
        <div className="glass grid h-96 place-items-center rounded-3xl">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {isError && (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl p-12 text-center">
          <CloudOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Wetterdaten konnten nicht geladen werden.</p>
          <button onClick={() => refetch()} className="rounded-xl bg-primary px-5 py-2 font-medium text-primary-foreground">
            Erneut versuchen
          </button>
        </div>
      )}

      {data && <WeatherHero location={location} data={data} />}

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        Daten von <a href="https://open-meteo.com" className="underline hover:text-foreground">Open-Meteo</a> · ICON-D2
      </footer>
    </div>
  );
}
