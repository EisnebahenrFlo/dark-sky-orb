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
  const capeValid = cape != null && !Number.isNaN(cape);
  const liValid = li != null && !Number.isNaN(li);

  if (!capeValid && !liValid) {
    return { risk: 0, label: "Keine Daten", color: "transparent" };
  }

  // CAPE-only fallback wenn LI fehlt
  if (capeValid && !liValid) {
    if (cape! >= 2500) return { risk: 75, label: "Hoch", color: "#f97316" };
    if (cape! >= 1500) return { risk: 50, label: "Mäßig", color: "#fbbf24" };
    if (cape! >= 500) return { risk: 20, label: "Möglich", color: "#10b981" };
    return { risk: 0, label: "Kein", color: "transparent" };
  }

  if (!capeValid) {
    return { risk: 0, label: "Kein", color: "transparent" };
  }

  if (cape! < 100 || li! > 2) return { risk: 0, label: "Kein", color: "transparent" };
  if (cape! < 500 && li! > 0) return { risk: 20, label: "Niedrig", color: "#10b981" };
  if (cape! < 1500 && li! > -2) return { risk: 50, label: "Mäßig", color: "#fbbf24" };
  if (cape! < 2500 && li! > -4) return { risk: 75, label: "Hoch", color: "#f97316" };
  return { risk: 95, label: "Sehr hoch", color: "#ef4444" };
}

/**
 * Aggregiert das Tages-Maximum aus stündlichen CAPE/LI-Werten,
 * indem pro Stunde das Risiko berechnet und das Maximum zurückgegeben wird.
 * Optional: lightning_potential als zusätzlicher Indikator.
 */
export function dailyThunderRiskFromHourly(
  hourlyTimes: string[] | undefined,
  cape: number[] | undefined,
  li: number[] | undefined,
  dayIso: string,
  lightningPotential?: number[] | undefined,
): ThunderRisk {
  if (!hourlyTimes || !cape) return { risk: 0, label: "Kein", color: "transparent" };
  const day = dayIso.slice(0, 10);
  let best: ThunderRisk = { risk: 0, label: "Kein", color: "transparent" };
  let maxLp = 0;
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (!hourlyTimes[i].startsWith(day)) continue;
    const r = calculateThunderRisk(cape[i], li?.[i]);
    if (r.risk > best.risk) best = r;
    const lp = lightningPotential?.[i];
    if (lp != null && !Number.isNaN(lp) && lp > maxLp) maxLp = lp;
  }
  if (maxLp > 5 && best.risk < 20) {
    best = { risk: 20, label: "Möglich", color: "#10b981" };
  }
  return best;
}
