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
  const json = (await res.json()) as RainbowData;
  // Range -1h bis +2h für flüssige Animation: Backend liefert -2h/+4h,
  // wir filtern client-seitig auf die für UI relevante Auswahl.
  const past = (json.past ?? []).filter((f) => f.offset >= -3600 && f.offset <= 0);
  const nowcast = (json.nowcast ?? []).filter((f) => f.offset >= 600 && f.offset <= 7200);
  return { ...json, past, nowcast };
}

/**
 * Build a tile URL for our Vercel proxy.
 * - Past frames: snapshot+offset as snapshot, forecast_time=0
 * - Nowcast frames: snapshot as snapshot, offset as forecast_time
 * color=2 → Dark Sky palette (siehe https://doc.rainbow.ai/tile_colors/)
 */
export function frameTileUrl(
  snapshot: number,
  frame: RainbowFrame,
  color: number = 2,
): string {
  const snap = frame.isPast ? snapshot + frame.offset : snapshot;
  const forecastTime = frame.isPast ? 0 : frame.offset;
  return `/api/rainbow-tile?snapshot=${snap}&forecast_time=${forecastTime}&z={z}&x={x}&y={y}&color=${color}`;
}
