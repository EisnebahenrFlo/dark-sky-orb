import { useState } from "react";

type GeolocationStatus = "idle" | "loading" | "success" | "error";

interface GeolocationState {
  status: GeolocationStatus;
  coords: { latitude: number; longitude: number } | null;
  cityName: string | null;
  countryCode: string | null;
  error: string | null;
}

export interface CachedGPSLocation {
  latitude: number;
  longitude: number;
  cityName: string;
  countryCode: string;
  timestamp: number;
}

const CACHE_KEY = "meteoflo_gps_location";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    status: "idle",
    coords: null,
    cityName: null,
    countryCode: null,
    error: null,
  });

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "GPS wird von diesem Browser nicht unterstützt.",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "loading", error: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=de`,
          );
          const data = await res.json();
          const cityName: string =
            data.city || data.locality || data.principalSubdivision || "Unbekannter Ort";
          const countryCode: string = data.countryCode || "";

          const cached: CachedGPSLocation = {
            latitude,
            longitude,
            cityName,
            countryCode,
            timestamp: Date.now(),
          };
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
          } catch {
            // ignore quota errors
          }

          setState({
            status: "success",
            coords: { latitude, longitude },
            cityName,
            countryCode,
            error: null,
          });
        } catch {
          setState({
            status: "success",
            coords: { latitude, longitude },
            cityName: "Mein Standort",
            countryCode: "",
            error: null,
          });
        }
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Standortzugriff verweigert. Bitte in den Browser-Einstellungen erlauben.",
          2: "Standort konnte nicht ermittelt werden.",
          3: "Standortabfrage dauert zu lange. Bitte erneut versuchen.",
        };
        setState((s) => ({
          ...s,
          status: "error",
          error: messages[error.code] || "Unbekannter Fehler bei der Standortermittlung.",
        }));
      },
      {
        timeout: 10000,
        maximumAge: 300000,
        enableHighAccuracy: false,
      },
    );
  };

  const getCachedLocation = (): CachedGPSLocation | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw) as CachedGPSLocation;
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached;
    } catch {
      return null;
    }
  };

  return { ...state, requestLocation, getCachedLocation };
}
