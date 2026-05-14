import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CloudOff, RefreshCw } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { WeatherHero } from "@/components/WeatherHero";
import { WeatherSkeleton } from "@/components/WeatherSkeleton";
import { Nowcast } from "@/components/Nowcast";
import { HourlyForecast } from "@/components/HourlyForecast";
import { DailyForecast } from "@/components/DailyForecast";
import { useWeatherData } from "@/hooks/useWeatherData";
import type { GeoResult } from "@/lib/weather";

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

  const { data, isLoading, isFetching, isError, refresh, dataUpdatedAt } =
    useWeatherData(location.latitude, location.longitude);

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          <span className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">Meteo</span>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <button
            onClick={() => refresh()}
            disabled={isFetching}
            aria-label="Aktualisieren"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-white/5 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </header>

      <div className="mb-8">
        <SearchBar onSelect={handleSelect} recent={recent} onClearRecent={clearRecent} />
      </div>

      {isLoading && !data && <WeatherSkeleton />}

      {isError && !data && (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl p-12 text-center">
          <CloudOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            Konnte Daten nicht laden – nächster Versuch in 5 Min.
          </p>
          <button
            onClick={() => refresh()}
            className="rounded-xl bg-primary px-5 py-2 font-medium text-primary-foreground"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {data && (
        <div className="space-y-10">
          <WeatherHero location={location} data={data.current} updatedAt={dataUpdatedAt} />
          <Nowcast minutely={data.minutely_15} />
          <HourlyForecast hourly={data.hourly} />
          <DailyForecast daily={data.daily} />
        </div>
      )}

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        Daten von <a href="https://open-meteo.com" className="underline hover:text-foreground">Open-Meteo</a> · ICON-D2
      </footer>
    </div>
  );
}
