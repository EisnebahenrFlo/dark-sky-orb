import type { GeoResult } from "./weather";

export type Favorite = {
  id: string;
  name: string;
  region?: string;
  country: string;
  country_code: string;
  lat: number;
  lon: number;
};

const KEY = "meteoflo_favorites";
export const MAX_FAVORITES = 10;

export function favoriteIdFromGeo(g: { latitude: number; longitude: number }): string {
  return `${g.latitude.toFixed(4)}_${g.longitude.toFixed(4)}`;
}

export function geoToFavorite(g: GeoResult): Favorite {
  return {
    id: favoriteIdFromGeo(g),
    name: g.name,
    region: g.admin1,
    country: g.country,
    country_code: g.country_code,
    lat: g.latitude,
    lon: g.longitude,
  };
}

export function favoriteToGeo(f: Favorite): GeoResult {
  return {
    id: Math.abs(hashCode(f.id)),
    name: f.name,
    latitude: f.lat,
    longitude: f.lon,
    country: f.country,
    country_code: f.country_code,
    admin1: f.region,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

function isValid(f: unknown): f is Favorite {
  if (!f || typeof f !== "object") return false;
  const o = f as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.lat === "number" &&
    typeof o.lon === "number" &&
    typeof o.country === "string"
  );
}

export function loadFavorites(): Favorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export function saveFavorites(list: Favorite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}
