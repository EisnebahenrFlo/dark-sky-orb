import type { WeatherData, HourlyData, DailyData } from "@/lib/weather";

/**
 * Zentrale Bereinigung des kompletten WeatherData-Objekts.
 * Wird einmalig nach Ensemble → Station → Nowcast angewandt, damit Hero,
 * Stündlich, Täglich, Nowcast und Analyse dieselbe Wahrheit zeigen.
 *
 * Prinzipien:
 *  - Niederschlags-/Gewittercodes werden NIE auf "klar/sonnig" downgraded.
 *  - Aktiver Niederschlag (mm > 0.1) oder sehr hohe Wahrscheinlichkeit (≥ 70 %)
 *    überschreibt klare/leichte Codes mit mindestens "Regen".
 *  - Hohe LPI/CAPE-Evidenz wird stündlich als Gewittergefahr markiert.
 *  - Aktueller Slot wird mit der korrespondierenden Stunde abgeglichen.
 *  - Tagescodes werden aus den bereinigten Stundencodes neu abgeleitet.
 */
export function reconcileWeatherData(data: WeatherData): WeatherData {
  if (!data?.hourly?.time?.length) return data;
  const hourly = reconcileHourly(data.hourly);
  const current = reconcileCurrentWithHourly(data, hourly);
  const daily = reconcileDailyCodes(data.daily, hourly, current.time);
  return { ...data, hourly, current, daily };
}

const THUNDER = (c: number) => c === 95 || c === 96 || c === 99;
const PRECIP = (c: number) => (c >= 51 && c <= 67) || (c >= 71 && c <= 86);
const DRY = (c: number) => c >= 0 && c <= 3;

function upgradeForPrecip(precipMm: number): number {
  if (precipMm >= 2.5) return 63; // mäßiger Regen
  if (precipMm >= 0.5) return 61; // leichter Regen
  return 51; // Niesel/leicht
}

function thunderEvidence(
  lpi: number | undefined,
  cape: number | undefined,
  li: number | undefined,
  gust: number | undefined,
): boolean {
  const lpiVal = typeof lpi === "number" ? lpi : 0;
  const capeVal = typeof cape === "number" ? cape : 0;
  const liVal = typeof li === "number" ? li : 99;
  const gustVal = typeof gust === "number" ? gust : 0;
  // Direktes Blitz-Signal vom Modell
  if (lpiVal >= 3) return true;
  // Hohe CAPE + instabile Schichtung + organisierte Böen
  if (capeVal >= 1500 && liVal <= -2 && gustVal >= 40) return true;
  return false;
}

function reconcileHourly(h: HourlyData): HourlyData {
  const codes = [...h.weather_code];
  const precip = h.precipitation ?? [];
  const pop = h.precipitation_probability ?? [];
  const lpi = h.lightning_potential;
  const cape = h.cape;
  const li = h.lifted_index;
  const gusts = h.wind_gusts_10m;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (THUNDER(code)) continue;

    const p = precip[i] ?? 0;
    const probability = pop[i] ?? 0;

    // 1) Gewitterevidenz: Code auf 95 anheben, wenn aktuell trocken-codiert
    //    und Modell-Signale stark sind.
    if (thunderEvidence(lpi?.[i], cape?.[i], li?.[i], gusts?.[i])) {
      // Niesel/Regen bleiben erhalten, falls bereits Niederschlag codiert
      if (DRY(code) || code === 45 || code === 48) {
        codes[i] = 95;
        continue;
      }
    }

    // 2) Niederschlag-Evidenz: trockenen Code anheben
    if (DRY(code)) {
      if (p >= 0.1) {
        codes[i] = upgradeForPrecip(p);
      } else if (probability >= 70) {
        codes[i] = 51; // hohe Wahrscheinlichkeit → mind. Nieselregen-Risiko
      }
    } else if (PRECIP(code) && p >= 0.1) {
      // Stärke nachschärfen, wenn Modell Code untertreibt
      const upgraded = upgradeForPrecip(p);
      if (upgraded > code && code < 80) codes[i] = upgraded;
    }
  }

  return { ...h, weather_code: codes };
}

function reconcileCurrentWithHourly(
  data: WeatherData,
  hourly: HourlyData,
): WeatherData["current"] {
  const current = { ...data.current };
  if (THUNDER(current.weather_code)) return current;

  const nowMs = new Date(current.time).getTime();
  // Index der Stunde, die `now` enthält (oder die nächstliegende)
  let idx = -1;
  let best = Infinity;
  for (let i = 0; i < hourly.time.length; i++) {
    const t = new Date(hourly.time[i]).getTime();
    const diff = Math.abs(t - nowMs);
    if (diff < best) {
      best = diff;
      idx = i;
    }
  }
  if (idx < 0) return current;

  const hCode = hourly.weather_code[idx];
  const hPrecip = hourly.precipitation?.[idx] ?? 0;
  const hPop = hourly.precipitation_probability?.[idx] ?? 0;

  // Wenn die bereinigte Stunde Regen/Gewitter sagt, der current-Code aber
  // klar/leicht ist → übernehmen (Modell-Stunde hat 15-Min-Auflösung berücksichtigt
  // und ist im Ensemble-Konsens).
  if (THUNDER(hCode)) {
    current.weather_code = hCode;
    current.precipitation = Math.max(current.precipitation ?? 0, hPrecip);
    return current;
  }
  if (PRECIP(hCode) && DRY(current.weather_code)) {
    current.weather_code = hCode;
    current.precipitation = Math.max(current.precipitation ?? 0, hPrecip);
    return current;
  }
  if (DRY(current.weather_code) && hPop >= 70 && hPrecip >= 0.1) {
    current.weather_code = upgradeForPrecip(hPrecip);
    current.precipitation = Math.max(current.precipitation ?? 0, hPrecip);
  }
  return current;
}

function reconcileDailyCodes(
  daily: DailyData,
  hourly: HourlyData,
  currentTimeIso: string,
): DailyData {
  if (!daily?.time?.length || !hourly?.time?.length) return daily;
  const codes = [...daily.weather_code];
  const nowH = new Date(currentTimeIso).getHours();

  // Indizes je Datum gruppieren
  const byDate = new Map<string, number[]>();
  for (let i = 0; i < hourly.time.length; i++) {
    const d = hourly.time[i].slice(0, 10);
    let arr = byDate.get(d);
    if (!arr) {
      arr = [];
      byDate.set(d, arr);
    }
    arr.push(i);
  }

  for (let d = 0; d < daily.time.length; d++) {
    const dateStr = daily.time[d].slice(0, 10);
    const idxs = byDate.get(dateStr);
    if (!idxs || idxs.length < 6) continue;

    const isToday = d === 0;
    const weighted: Array<{ code: number; weight: number }> = [];
    for (const i of idxs) {
      const hour = new Date(hourly.time[i]).getHours();
      // Nachtstunden weniger gewichten, Tagesstunden stärker
      if (hour < 6 || hour > 21) continue;
      let weight = 1;
      if (isToday) {
        if (hour < nowH) continue; // vergangene Stunden ignorieren
        if (hour <= nowH + 3) weight = 4;
        else if (hour <= nowH + 6) weight = 2;
      } else if (hour >= 10 && hour <= 17) {
        weight = 2;
      }
      weighted.push({ code: hourly.weather_code[i], weight });
    }
    if (!weighted.length) continue;

    // Buckets nach Schweregrad-Kategorie zählen
    const buckets = new Map<number, number>();
    for (const { code, weight } of weighted) {
      const cat = severityCategory(code);
      buckets.set(cat, (buckets.get(cat) ?? 0) + weight);
    }
    let bestCat = 0;
    let bestWeight = -1;
    for (const [cat, w] of buckets) {
      if (w > bestWeight) {
        bestWeight = w;
        bestCat = cat;
      }
    }
    // Aber: Wenn IRGENDEINE Stunde Gewitter/heftiger Regen meldet, das gewinnt
    // (Tagescode soll Worst-Case der Tagesstunden zeigen).
    const hasThunder = weighted.some((w) => THUNDER(w.code));
    const hasHeavy = weighted.some((w) => w.code >= 65 && w.code <= 82);
    if (hasThunder) {
      codes[d] = 95;
    } else if (hasHeavy && bestCat < 4) {
      codes[d] = 80;
    } else {
      codes[d] = representativeCodeForCategory(bestCat, weighted);
    }
  }

  return { ...daily, weather_code: codes };
}

function severityCategory(code: number): number {
  if (THUNDER(code)) return 6;
  if (code >= 80) return 5;
  if (code >= 71 && code <= 77) return 5;
  if (code >= 61) return 4;
  if (code >= 51) return 3;
  if (code === 45 || code === 48) return 2;
  if (code === 3) return 1;
  if (code === 2) return 0.5;
  return 0;
}

function representativeCodeForCategory(
  cat: number,
  weighted: Array<{ code: number; weight: number }>,
): number {
  // Häufigsten Code innerhalb der Kategorie zurückgeben
  const inCat = weighted.filter((w) => severityCategory(w.code) === cat);
  if (!inCat.length) {
    if (cat >= 6) return 95;
    if (cat >= 5) return 80;
    if (cat >= 4) return 61;
    if (cat >= 3) return 51;
    if (cat >= 2) return 45;
    if (cat >= 1) return 3;
    if (cat >= 0.5) return 2;
    return 0;
  }
  const counts = new Map<number, number>();
  for (const { code, weight } of inCat) {
    counts.set(code, (counts.get(code) ?? 0) + weight);
  }
  let bestCode = inCat[0].code;
  let bestW = -1;
  for (const [code, w] of counts) {
    if (w > bestW) {
      bestW = w;
      bestCode = code;
    }
  }
  return bestCode;
}
