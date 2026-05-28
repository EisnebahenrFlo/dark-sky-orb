import type { BlitzStrike } from "@/lib/blitzortungDecoder";

/** Great-circle distance in km between two lat/lon points (Haversine). */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Initial bearing in degrees from point 1 to point 2 (0 = N, 90 = E). */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
export function compassFromBearing(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8];
}

export interface LightningCluster {
  /** Mean position of all strikes in the cluster */
  lat: number;
  lon: number;
  /** Number of strikes */
  count: number;
  /** Most recent strike time (ms epoch) */
  lastStrike: number;
  /** Strike density (strikes per minute, last 10 min only) */
  ratePerMin: number;
}

/**
 * Lightweight grid-based clustering. We bin strikes into ~0.25° grid cells
 * (~25 km), then merge adjacent non-empty cells. DBSCAN would be more
 * accurate but for a few hundred points this is fast and produces visually
 * stable cluster centers.
 */
export function clusterStrikes(
  strikes: BlitzStrike[],
  opts: { cellDeg?: number; minStrikes?: number; maxAgeMs?: number } = {},
): LightningCluster[] {
  const cellDeg = opts.cellDeg ?? 0.25;
  const minStrikes = opts.minStrikes ?? 3;
  const maxAgeMs = opts.maxAgeMs ?? 30 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;

  const cells = new Map<string, BlitzStrike[]>();
  for (const s of strikes) {
    if (s.time < cutoff) continue;
    const cx = Math.floor(s.lat / cellDeg);
    const cy = Math.floor(s.lon / cellDeg);
    const key = `${cx}_${cy}`;
    const arr = cells.get(key);
    if (arr) arr.push(s);
    else cells.set(key, [s]);
  }

  // Flood-fill merge of adjacent populated cells.
  const visited = new Set<string>();
  const clusters: BlitzStrike[][] = [];

  const neighbors = (key: string) => {
    const [a, b] = key.split("_").map(Number);
    const out: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const k = `${a + dx}_${b + dy}`;
        if (cells.has(k)) out.push(k);
      }
    }
    return out;
  };

  for (const key of cells.keys()) {
    if (visited.has(key)) continue;
    const stack = [key];
    const group: BlitzStrike[] = [];
    while (stack.length) {
      const k = stack.pop()!;
      if (visited.has(k)) continue;
      visited.add(k);
      const arr = cells.get(k);
      if (arr) group.push(...arr);
      for (const n of neighbors(k)) if (!visited.has(n)) stack.push(n);
    }
    if (group.length >= minStrikes) clusters.push(group);
  }

  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  return clusters
    .map((group) => {
      let sumLat = 0;
      let sumLon = 0;
      let last = 0;
      let recent = 0;
      for (const s of group) {
        sumLat += s.lat;
        sumLon += s.lon;
        if (s.time > last) last = s.time;
        if (s.time >= tenMinAgo) recent++;
      }
      return {
        lat: sumLat / group.length,
        lon: sumLon / group.length,
        count: group.length,
        lastStrike: last,
        ratePerMin: recent / 10,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface NearestStrikeInfo {
  strike: BlitzStrike;
  distanceKm: number;
  bearing: number;
  compass: string;
  ageMs: number;
}

export function findNearestStrike(
  strikes: BlitzStrike[],
  lat: number,
  lon: number,
  maxAgeMs = 30 * 60 * 1000,
): NearestStrikeInfo | null {
  const cutoff = Date.now() - maxAgeMs;
  let best: NearestStrikeInfo | null = null;
  for (const s of strikes) {
    if (s.time < cutoff) continue;
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (!best || d < best.distanceKm) {
      const b = bearingDeg(lat, lon, s.lat, s.lon);
      best = {
        strike: s,
        distanceKm: d,
        bearing: b,
        compass: compassFromBearing(b),
        ageMs: Date.now() - s.time,
      };
    }
  }
  return best;
}
