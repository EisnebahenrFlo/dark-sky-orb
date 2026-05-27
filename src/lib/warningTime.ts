export type WarningTiming =
  | { state: "active"; msUntilEnd: number }
  | { state: "upcoming"; msUntilStart: number }
  | { state: "past" };

export function getWarningTiming(startIso: string, endIso: string, now = Date.now()): WarningTiming {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return { state: "past" };
  if (now < s) return { state: "upcoming", msUntilStart: s - now };
  if (now > e) return { state: "past" };
  return { state: "active", msUntilEnd: e - now };
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} Min.`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m > 0 ? `${h} Std. ${m} Min.` : `${h} Std.`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d} Tag${d > 1 ? "e" : ""} ${rh} Std.` : `${d} Tag${d > 1 ? "e" : ""}`;
}

export function formatRelativeStart(ms: number): string {
  return `in ${formatDuration(ms)}`;
}

export function formatRemaining(ms: number): string {
  return `noch ${formatDuration(ms)}`;
}
