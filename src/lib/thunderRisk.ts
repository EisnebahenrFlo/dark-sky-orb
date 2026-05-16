/**
 * Basis-Heuristik für Gewitter-Risiko basierend auf CAPE und Lifted Index.
 * Phase 1 — einfache Schwellwerte, später KI-Verfeinerung.
 */
export interface ThunderRisk {
  risk: number; // 0..100
  label: string;
  color: string; // hex or "transparent"
}

export function calculateThunderRisk(
  cape: number | null | undefined,
  li: number | null | undefined,
): ThunderRisk {
  if (cape == null || li == null || Number.isNaN(cape) || Number.isNaN(li)) {
    return { risk: 0, label: "Keine Daten", color: "transparent" };
  }
  if (cape < 100 || li > 2) return { risk: 0, label: "Kein", color: "transparent" };
  if (cape < 500 && li > 0) return { risk: 20, label: "Niedrig", color: "#10b981" };
  if (cape < 1500 && li > -2) return { risk: 50, label: "Mäßig", color: "#fbbf24" };
  if (cape < 2500 && li > -4) return { risk: 75, label: "Hoch", color: "#f97316" };
  return { risk: 95, label: "Sehr hoch", color: "#ef4444" };
}

/**
 * Aggregiert das Tages-Maximum aus stündlichen CAPE/LI-Werten,
 * indem pro Stunde das Risiko berechnet und das Maximum zurückgegeben wird.
 */
export function dailyThunderRiskFromHourly(
  hourlyTimes: string[] | undefined,
  cape: number[] | undefined,
  li: number[] | undefined,
  dayIso: string,
): ThunderRisk {
  if (!hourlyTimes || !cape || !li) return { risk: 0, label: "Kein", color: "transparent" };
  const day = dayIso.slice(0, 10);
  let best: ThunderRisk = { risk: 0, label: "Kein", color: "transparent" };
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (!hourlyTimes[i].startsWith(day)) continue;
    const r = calculateThunderRisk(cape[i], li[i]);
    if (r.risk > best.risk) best = r;
  }
  return best;
}
