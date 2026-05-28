import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useWeatherData, type UseWeatherDataResult } from "@/hooks/useWeatherData";
import { useStationObservation } from "@/hooks/useStationObservation";
import { mergeStationIntoWeather } from "@/lib/stationMerge";
import type { GeoResult } from "@/lib/weather";

const RECENT_KEY = "weather:recent";
const SELECTED_KEY = "weather:selected";

const DEFAULT: GeoResult = {
  id: 2950159,
  name: "Berlin",
  latitude: 52.52,
  longitude: 13.405,
  country: "Deutschland",
  country_code: "DE",
  admin1: "Berlin",
};

interface WeatherCtx extends UseWeatherDataResult {
  location: GeoResult;
  recent: GeoResult[];
  selectLocation: (loc: GeoResult) => void;
  clearRecent: () => void;
}

const Ctx = createContext<WeatherCtx | null>(null);

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<GeoResult | null>(null);
  const [recent, setRecent] = useState<GeoResult[]>([]);

  useEffect(() => {
    setLocation(load(SELECTED_KEY, DEFAULT));
    setRecent(load<GeoResult[]>(RECENT_KEY, []));
  }, []);

  const selectLocation = (loc: GeoResult) => {
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

  const data = useWeatherData(location?.latitude ?? 0, location?.longitude ?? 0, !!location, location?.country_code);
  const { observation } = useStationObservation(
    location?.latitude ?? 0,
    location?.longitude ?? 0,
    location?.country_code,
    !!location,
  );

  const merged = useMemo<UseWeatherDataResult>(() => {
    if (!data.data) return data;
    return { ...data, data: mergeStationIntoWeather(data.data, observation) };
  }, [data, observation]);

  return (
    <Ctx.Provider value={{ ...merged, location: location ?? DEFAULT, recent, selectLocation, clearRecent }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWeather() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWeather must be used inside WeatherProvider");
  return c;
}
