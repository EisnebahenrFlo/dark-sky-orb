/**
 * Beaufort-Skala (Bft) — aus Windgeschwindigkeit in km/h.
 * Quelle: WMO/DWD-Standardtabelle.
 */
export function beaufort(kmh: number): number {
  if (kmh < 1) return 0;
  if (kmh < 6) return 1;
  if (kmh < 12) return 2;
  if (kmh < 20) return 3;
  if (kmh < 29) return 4;
  if (kmh < 39) return 5;
  if (kmh < 50) return 6;
  if (kmh < 62) return 7;
  if (kmh < 75) return 8;
  if (kmh < 89) return 9;
  if (kmh < 103) return 10;
  if (kmh < 118) return 11;
  return 12;
}

const LABELS = [
  "Windstille",
  "Leiser Zug",
  "Leichte Brise",
  "Schwache Brise",
  "Mäßige Brise",
  "Frische Brise",
  "Starker Wind",
  "Steifer Wind",
  "Stürmischer Wind",
  "Sturm",
  "Schwerer Sturm",
  "Orkanartiger Sturm",
  "Orkan",
];

export function beaufortLabel(kmh: number): string {
  return LABELS[beaufort(kmh)];
}

export function beaufortBadge(kmh: number): string {
  return `Bft ${beaufort(kmh)} · ${beaufortLabel(kmh)}`;
}
