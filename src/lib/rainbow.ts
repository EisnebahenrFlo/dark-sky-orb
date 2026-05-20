export interface RainbowFrame {
  time: number;
  offset: number;
  isPast: boolean;
}

export interface RainbowData {
  snapshot: number;
  past: RainbowFrame[];
  nowcast: RainbowFrame[];
  stale?: boolean;
  cached?: boolean;
  ageMinutes?: number;
}

export async function fetchRainbow(): Promise<RainbowData> {
  const res = await fetch('/api/rainbow-snapshot');
  if (!res.ok) throw new Error('Rainbow.ai Snapshot fehlgeschlagen');
  return (await res.json()) as RainbowData;
}

/**
 * Build a tile URL for our Vercel proxy.
 * - Past frames: snapshot+offset as snapshot, forecast_time=0
 * - Nowcast frames: snapshot as snapshot, offset as forecast_time
 */
export function frameTileUrl(
  snapshot: number,
  frame: RainbowFrame,
  color: number = 1,
): string {
  const snap = frame.isPast ? snapshot + frame.offset : snapshot;
  const forecastTime = frame.isPast ? 0 : frame.offset;
  return `/api/rainbow-tile?snapshot=${snap}&forecast_time=${forecastTime}&z={z}&x={x}&y={y}&color=${color}`;
}
