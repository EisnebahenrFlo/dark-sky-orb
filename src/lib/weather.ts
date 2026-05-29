import { buildEnsemble } from "@/lib/modelEnsemble";

export interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
  admin2?: string;
  population?: number;
  postcodes?: string[];
}

export interface CurrentWeather {
  temperature_2m: number;
  apparent_temperature: number;
  relative_humidity_2m: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  wind_direction_10m: number;
  pressure_msl: number;
  precipitation: number;
  /** Echte 10-Minuten-Summe vom Boden­messpunkt (mm), falls Station-Override aktiv.
   *  Steht parallel zu `precipitation` (Modell-Stundenwert), damit UIs den richtigen
   *  Bezugszeitraum anzeigen können. */
  precipitation_10min?: number;
  cloud_cover: number;
  /** Low-/Mid-Wolken aus hourly[0] gespiegelt — für realistische Bewölkungs­beschreibung
   *  (Cirren sollen nicht „bedeckt" auslösen). */
  cloud_cover_low?: number;
  cloud_cover_mid?: number;
  /** Sichtweite in Metern aus hourly[curIdx] für Hero-Nebel-Kachel. */
  visibility?: number;
  is_day: number;
  uv_index?: number;
  time: string;
  /** Where the displayed "current" values come from after station merge. */
  _source?: "station" | "model";
  _station?: {
    name: string;
    distanceKm: number;
    ageMin: number;
    source: "brightsky" | "metar";
  };
  _diagnostics?: {
    stationApplied?: boolean;
    nowcastApplied?: boolean;
    rainbowApplied?: boolean;
    effectiveCode?: number;
  };
  /** Confidence 0..100 from multi-model spread (100 when station-overridden). */
  _confidence?: number;
}

export interface EnsembleMeta {
  models: string[];
  hourlyConfidence: number[];
  currentConfidence: number;
  spread: { temp: number[]; pop: number[] };
}

export interface MinutelyData {
  time: string[];
  precipitation: number[];
  weather_code: number[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  lightning_potential_index?: number[];
}


export interface HourlyData {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation: number[];
  precipitation_probability: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  wind_direction_10m: number[];
  cloud_cover: number[];
  cloud_cover_low: number[];
  cloud_cover_mid: number[];
  cloud_cover_high: number[];
  relative_humidity_2m: number[];
  uv_index: number[];
  is_day: number[];
  lightning_potential?: number[];
  snowfall?: number[];
  visibility?: number[];
  wet_bulb_temperature_2m?: number[];
  freezing_level_height?: number[];

  // Synoptic / pressure-level fields
  dewpoint_2m?: number[];
  cape?: number[];
  lifted_index?: number[];
  convective_inhibition?: number[];
  temperature_850hPa?: number[];
  temperature_700hPa?: number[];
  temperature_500hPa?: number[];
  temperature_300hPa?: number[];
  geopotential_height_500hPa?: number[];
  geopotential_height_850hPa?: number[];
  wind_speed_850hPa?: number[];
  wind_direction_850hPa?: number[];
  wind_speed_500hPa?: number[];
  wind_direction_500hPa?: number[];
  wind_speed_300hPa?: number[];
  wind_direction_300hPa?: number[];
  relative_humidity_850hPa?: number[];
  relative_humidity_700hPa?: number[];
  vertical_velocity_700hPa?: number[];
}

export interface DailyData {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  showers_sum: number[];
  snowfall_sum: number[];
  precipitation_hours: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  current: CurrentWeather;
  minutely_15: MinutelyData;
  hourly: HourlyData;
  daily: DailyData;
  timezone: string;
  /** Multi-model ensemble metadata (spread + per-hour confidence). */
  _ensemble?: EnsembleMeta;
}

const ALLOWED_COUNTRIES = new Set(["DE", "AT", "CH", "IT"]);

async function searchByPostalCode(plz: string): Promise<GeoResult[]> {
  const countries: Array<{ code: "DE" | "AT" | "CH" | "IT"; name: string }> = [
    { code: "DE", name: "Deutschland" },
    { code: "AT", name: "Österreich" },
    { code: "CH", name: "Schweiz" },
    { code: "IT", name: "Italien" },
  ];
  const responses = await Promise.all(
    countries.map(({ code }) =>
      fetch(`https://api.zippopotam.us/${code.toLowerCase()}/${encodeURIComponent(plz)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  );
  const out: GeoResult[] = [];
  responses.forEach((data, i) => {
    if (!data || !Array.isArray(data.places)) return;
    const { code, name } = countries[i];
    data.places.forEach((p: any, idx: number) => {
      out.push({
        id: Number(`${Date.now() % 1_000_000}${i}${idx}`),
        name: p["place name"],
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        country: name,
        country_code: code,
        admin1: p.state || undefined,
        postcodes: [plz],
      });
    });
  });
  return out;
}

/** Eingabe normalisieren: trim + kollabierte Whitespaces. */
function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

function dedupeGeo(list: GeoResult[]): GeoResult[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const k = `${r.country_code}-${r.name.toLowerCase()}-${r.latitude.toFixed(2)}-${r.longitude.toFixed(2)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

let activeSearchController: AbortController | null = null;

export async function searchCities(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  if (/^\d{1,3}$/.test(trimmed)) return [];

  // Vorherige Suche abbrechen
  activeSearchController?.abort();
  const controller = new AbortController();
  activeSearchController = controller;
  const { signal } = controller;

  // PLZ: Open-Meteo + Zippopotam (DACH+IT) parallel, dedupliziert
  if (/^\d{4,5}$/.test(trimmed)) {
    const [omRes, zipRes] = await Promise.all([
      fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=20&language=de`,
        { signal },
      )
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .catch(() => ({ results: [] })),
      searchByPostalCode(trimmed),
    ]);
    const omFiltered: GeoResult[] = (omRes.results ?? []).filter((r: GeoResult) =>
      ALLOWED_COUNTRIES.has(r.country_code?.toUpperCase() ?? ""),
    );
    const deduped = dedupeGeo([...omFiltered, ...zipRes]);
    deduped.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
    return deduped;
  }

  // Stadtname-Suche mit größerem count + Dedupe + Population-Sortierung
  const normalized = normalizeQuery(trimmed);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalized)}&count=20&language=de`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Suche fehlgeschlagen");
  const data = await res.json();
  const results: GeoResult[] = data.results ?? [];
  const filtered = results.filter((r) => ALLOWED_COUNTRIES.has(r.country_code?.toUpperCase() ?? ""));
  const deduped = dedupeGeo(filtered);
  deduped.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  return deduped;
}

/**
 * Multi-model ensemble per region. Open-Meteo accepts comma-separated models
 * in a single request; we then merge them in `buildEnsemble`.
 */
export function getWeatherModels(countryCode?: string): string[] {
  // Hinweis: ARPAE COSMO 2i/5m wurden von Open-Meteo abgeschaltet
  // ("ARPAE COSMO models are not available anymore") und sind hier entfernt.
  // ItaliaMeteo ARPAE ICON 2i bleibt als hochauflösendes IT-Modell.
  switch (countryCode?.toUpperCase()) {
    case "DE":
      return ["icon_d2", "icon_eu", "ecmwf_ifs025", "knmi_harmonie_arome_europe"];
    case "AT":
      return ["icon_d2", "icon_eu", "ecmwf_ifs025", "knmi_harmonie_arome_europe"];
    case "CH":
      return ["meteoswiss_icon_ch2", "icon_d2", "ecmwf_ifs025", "knmi_harmonie_arome_europe"];
    case "IT":
      return ["italia_meteo_arpae_icon_2i", "icon_eu", "ecmwf_ifs025", "knmi_harmonie_arome_europe"];
    default:
      return ["best_match"];
  }
}

export function getWeatherModelLabel(countryCode?: string): string {
  const models = getWeatherModels(countryCode).join(", ");
  switch (countryCode?.toUpperCase()) {
    case "DE":
      return `Ensemble: DWD ICON-D2 · ICON-EU · ECMWF IFS · KNMI Harmonie (Konsens)`;
    case "AT":
      return `Ensemble: ICON-D2 · ICON-EU · ECMWF IFS · KNMI Harmonie (Konsens)`;
    case "CH":
      return `Ensemble: MeteoSwiss ICON-CH2 · ICON-D2 · ECMWF IFS · KNMI Harmonie (Konsens)`;
    // (Modell-IDs siehe getWeatherModels)
    case "IT":
      return `Ensemble: ItaliaMeteo ARPAE ICON-2i · ICON-EU · ECMWF IFS · KNMI Harmonie (Konsens)`;
    default:
      return `Datenquelle: ${models}`;
  }
}

function getCurrentUvFromLongTerm(
  currentTime: string,
  longHourly: { time: string[]; uv_index: number[] },
): number {
  if (!longHourly?.time || !longHourly?.uv_index) return 0;
  const now = new Date(currentTime).getTime();
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < longHourly.time.length; i++) {
    const diff = Math.abs(new Date(longHourly.time[i]).getTime() - now);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return longHourly.uv_index[bestIdx] ?? 0;
}

function getDayRepresentativeCode(
  hourlyTimes: string[],
  hourlyCodes: number[],
  dateStr: string,
  isToday: boolean,
  currentHour: number,
): number {
  const relevant: Array<{ code: number; weight: number }> = [];
  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = new Date(hourlyTimes[i]);
    const tDate = t.toISOString().slice(0, 10);
    const hour = t.getHours();
    if (tDate !== dateStr) continue;
    if (hour < 7 || hour > 20) continue;
    let weight = 1;
    if (isToday) {
      if (hour < currentHour) continue;
      if (hour <= currentHour + 3) weight = 4;
      else if (hour <= currentHour + 6) weight = 2;
    } else {
      if (hour >= 10 && hour <= 15) weight = 3;
    }
    relevant.push({ code: hourlyCodes[i], weight });
  }
  if (relevant.length === 0) return 0;
  const categorize = (code: number): number => {
    if (code >= 95) return 6;
    if (code >= 80) return 5;
    if (code >= 61) return 4;
    if (code >= 51) return 3;
    if (code === 45 || code === 48) return 2;
    if (code === 3) return 1;
    if (code === 2) return 0.5;
    return 0;
  };
  const totalWeight = relevant.reduce((s, r) => s + r.weight, 0);
  const weightedScore =
    relevant.reduce((s, r) => s + categorize(r.code) * r.weight, 0) / totalWeight;
  if (weightedScore >= 5.5) return 95;
  if (weightedScore >= 4.5) return 80;
  if (weightedScore >= 3.5) return 61;
  if (weightedScore >= 2.5) return 51;
  if (weightedScore >= 1.5) return 45;
  if (weightedScore >= 0.8) return 3;
  if (weightedScore >= 0.3) return 2;
  if (weightedScore >= 0.1) return 1;
  return 0;
}

/**
 * Tagessumme/-extrema aus der stündlichen Ensemble-Reihe rekonstruieren,
 * damit Daily nicht mehr vom `best_match`-Modell der separaten Daily-API
 * abweicht. Nur Tage mit ausreichend Abdeckung (≥ 12 h) werden überschrieben;
 * für die hinteren Tage 3–7 bleibt die best_match-Daily erhalten.
 *
 * Sunrise/Sunset und UV-Index sind astronomisch/aus der langen Hourly,
 * die werden absichtlich nicht überschrieben.
 */
function reconcileDailyFromHourly(
  daily: DailyData,
  hourlyTime: string[],
  hourly: HourlyData,
  representativeCodes: number[],
): DailyData {
  const out: DailyData = {
    ...daily,
    weather_code: [...daily.weather_code],
    temperature_2m_max: [...daily.temperature_2m_max],
    temperature_2m_min: [...daily.temperature_2m_min],
    apparent_temperature_max: [...daily.apparent_temperature_max],
    apparent_temperature_min: [...daily.apparent_temperature_min],
    precipitation_sum: [...daily.precipitation_sum],
    precipitation_hours: [...daily.precipitation_hours],
    precipitation_probability_max: [...daily.precipitation_probability_max],
    wind_speed_10m_max: [...daily.wind_speed_10m_max],
    wind_gusts_10m_max: [...daily.wind_gusts_10m_max],
    wind_direction_10m_dominant: [...daily.wind_direction_10m_dominant],
    snowfall_sum: [...daily.snowfall_sum],
  };

  // Indizes der Stunden pro Datum sammeln
  const byDate = new Map<string, number[]>();
  for (let i = 0; i < hourlyTime.length; i++) {
    const d = hourlyTime[i].slice(0, 10);
    let arr = byDate.get(d);
    if (!arr) { arr = []; byDate.set(d, arr); }
    arr.push(i);
  }

  for (let d = 0; d < daily.time.length; d++) {
    const dateStr = daily.time[d].slice(0, 10);
    const idxs = byDate.get(dateStr);
    if (!idxs || idxs.length < 12) continue; // unzureichende Ensemble-Abdeckung

    const pick = (arr: number[] | undefined): number[] =>
      arr ? idxs.map((i) => arr[i]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)) : [];

    const temps = pick(hourly.temperature_2m);
    const apps = pick(hourly.apparent_temperature);
    const precs = pick(hourly.precipitation);
    const winds = pick(hourly.wind_speed_10m);
    const gusts = pick(hourly.wind_gusts_10m);
    const pops = pick(hourly.precipitation_probability);
    const snows = pick(hourly.snowfall);

    if (temps.length) {
      out.temperature_2m_max[d] = Math.max(...temps);
      out.temperature_2m_min[d] = Math.min(...temps);
    }
    if (apps.length) {
      out.apparent_temperature_max[d] = Math.max(...apps);
      out.apparent_temperature_min[d] = Math.min(...apps);
    }
    if (precs.length) {
      out.precipitation_sum[d] = precs.reduce((s, v) => s + Math.max(0, v), 0);
      out.precipitation_hours[d] = precs.filter((v) => v >= 0.1).length;
    }
    if (winds.length) out.wind_speed_10m_max[d] = Math.max(...winds);
    if (gusts.length) out.wind_gusts_10m_max[d] = Math.max(...gusts);
    if (pops.length) out.precipitation_probability_max[d] = Math.max(...pops);
    if (snows.length) out.snowfall_sum[d] = snows.reduce((s, v) => s + Math.max(0, v), 0);
    if (representativeCodes[d] != null) out.weather_code[d] = representativeCodes[d];
  }

  return out;
}

export async function fetchWeather(lat: number, lon: number, countryCode?: string): Promise<WeatherData> {
  const models = getWeatherModels(countryCode);
  const isEnsemble = models.length > 1;

  const shortParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,precipitation,cloud_cover,is_day",
    minutely_15: "precipitation,weather_code,temperature_2m,wind_speed_10m",
    forecast_minutely_15: "24",
    hourly:
      "temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,uv_index,is_day,lightning_potential,snowfall,visibility,wet_bulb_temperature_2m,freezing_level_height,dewpoint_2m,cape,lifted_index,convective_inhibition,temperature_850hPa,temperature_700hPa,temperature_500hPa,temperature_300hPa,geopotential_height_500hPa,geopotential_height_850hPa,wind_speed_850hPa,wind_direction_850hPa,wind_speed_500hPa,wind_direction_500hPa,wind_speed_300hPa,wind_direction_300hPa,relative_humidity_850hPa,relative_humidity_700hPa,vertical_velocity_700hPa",
    forecast_hours: "48",
    timezone: "auto",
    models: models.join(","),
  });

  const longParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    hourly: "uv_index,precipitation_probability,is_day,weather_code",
    forecast_days: "7",
    timezone: "auto",
    models: "best_match",
  });

  const fetchWithFallback = async (params: URLSearchParams) => {
    // 1) Versuche projekteigene Function (bessere Caches, eigener API-Key)
    try {
      const r = await fetch(`/api/weather?${params.toString()}`);
      if (r.ok) return r.json();
    } catch {
      /* network / 503 → fallback */
    }
    // 2) Direkt zu Open-Meteo (CORS-fähig, kostenfrei) — funktioniert auch
    //    in Dev-Previews, in denen /api/* mit 503 geblockt wird.
    const direct = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!direct.ok) throw new Error("Wetterdaten fehlgeschlagen");
    return direct.json();
  };

  const [shortRaw, longJson] = (await Promise.all([
    fetchWithFallback(shortParams),
    fetchWithFallback(longParams),
  ])) as [Record<string, unknown>, WeatherData];


  // Multi-model: fold suffixed keys into consensus values.
  let mergedHourly: Record<string, unknown>;
  let mergedCurrent: Record<string, unknown>;
  let mergedMinutely: Record<string, unknown>;
  let ensembleMeta: WeatherData["_ensemble"];

  if (isEnsemble) {
    const ens = buildEnsemble(
      shortRaw.hourly as Record<string, unknown>,
      shortRaw.current as Record<string, unknown>,
      models,
    );
    mergedHourly = ens.hourly;
    mergedCurrent = ens.current;
    ensembleMeta = {
      models: ens.meta.models,
      hourlyConfidence: ens.meta.hourlyConfidence,
      currentConfidence: ens.meta.currentConfidence,
      spread: ens.meta.spread,
    };
    // Minutely_15: pick the first model that has data (high-res local model wins).
    const rawMinutely = shortRaw.minutely_15 as Record<string, unknown> | undefined;
    mergedMinutely = { time: rawMinutely?.time ?? [] };
    if (rawMinutely) {
      for (const field of ["precipitation", "weather_code", "temperature_2m", "wind_speed_10m"]) {
        for (const m of models) {
          const arr = rawMinutely[`${field}_${m}`] as unknown[] | undefined;
          if (Array.isArray(arr) && arr.some((v) => v != null)) {
            mergedMinutely[field] = arr;
            break;
          }
        }
        if (mergedMinutely[field] == null && rawMinutely[field] != null) {
          mergedMinutely[field] = rawMinutely[field];
        }
      }
    }
  } else {
    mergedHourly = (shortRaw.hourly as Record<string, unknown>) ?? {};
    mergedCurrent = (shortRaw.current as Record<string, unknown>) ?? {};
    mergedMinutely = (shortRaw.minutely_15 as Record<string, unknown>) ?? {};
  }

  const currentTime = String(mergedCurrent.time ?? new Date().toISOString());
  const currentUv = getCurrentUvFromLongTerm(currentTime, longJson.hourly);
  // Map long-term hourly arrays (uv_index, precipitation_probability) onto the
  // short hourly time grid by matching ISO timestamps.
  const longIdxByTime = new Map<string, number>();
  (longJson.hourly?.time ?? []).forEach((t, i) => longIdxByTime.set(t, i));
  const shortTimes = (mergedHourly.time as string[]) ?? [];
  const alignedUv = shortTimes.map((t, i) => {
    const j = longIdxByTime.get(t);
    const shortUv = (mergedHourly.uv_index as number[] | undefined)?.[i] ?? 0;
    return j != null ? longJson.hourly.uv_index?.[j] ?? 0 : shortUv;
  });
  const longPop = (longJson.hourly as unknown as { precipitation_probability?: number[] })
    ?.precipitation_probability;
  const shortPop = mergedHourly.precipitation_probability as number[] | undefined;
  const hasShortPop = Array.isArray(shortPop) && shortPop.some((v) => v != null && v > 0);
  const alignedPop = hasShortPop
    ? (shortPop as number[])
    : shortTimes.map((t, i) => {
        const j = longIdxByTime.get(t);
        return j != null ? longPop?.[j] ?? 0 : shortPop?.[i] ?? 0;
      });

  // Map low-/mid-cloud aus hourly auf "current" (Open-Meteo liefert sie nur stündlich).
  // Index der Stunde, die am nächsten an current.time liegt.
  const shortTimesForCloud = (mergedHourly.time as string[]) ?? [];
  const curTimeIdx = (() => {
    const t = currentTime.slice(0, 13); // YYYY-MM-DDTHH
    const i = shortTimesForCloud.findIndex((s) => s.slice(0, 13) === t);
    return i >= 0 ? i : 0;
  })();
  const lowAt = (mergedHourly.cloud_cover_low as number[] | undefined)?.[curTimeIdx];
  const midAt = (mergedHourly.cloud_cover_mid as number[] | undefined)?.[curTimeIdx];
  const visAt = (mergedHourly.visibility as number[] | undefined)?.[curTimeIdx];

  const finalCurrent = {
    ...(mergedCurrent as unknown as CurrentWeather),
    uv_index: currentUv,
    cloud_cover_low: typeof lowAt === "number" ? lowAt : undefined,
    cloud_cover_mid: typeof midAt === "number" ? midAt : undefined,
    visibility: typeof visAt === "number" ? visAt : undefined,
    _confidence: ensembleMeta?.currentConfidence,
  };

  const finalHourly: HourlyData = {
    ...(mergedHourly as unknown as HourlyData),
    uv_index: alignedUv,
    precipitation_probability: alignedPop,
  };

  const reconciledDaily = reconcileDailyFromHourly(
    longJson.daily,
    finalHourly.time,
    finalHourly,
    finalHourly.weather_code,
  );

  const json: WeatherData = {
    latitude: Number((shortRaw as { latitude?: number }).latitude ?? lat),
    longitude: Number((shortRaw as { longitude?: number }).longitude ?? lon),
    timezone: String((shortRaw as { timezone?: string }).timezone ?? "auto"),
    current: finalCurrent,
    minutely_15: mergedMinutely as unknown as MinutelyData,
    hourly: finalHourly,
    daily: reconciledDaily,
    _ensemble: ensembleMeta,
  };

  // eslint-disable-next-line no-console
  console.log("[weather] ensemble", {
    models,
    countryCode,
    currentConfidence: ensembleMeta?.currentConfidence,
    avgHourlyConfidence: ensembleMeta
      ? Math.round(
          ensembleMeta.hourlyConfidence.reduce((s, v) => s + v, 0) /
            Math.max(1, ensembleMeta.hourlyConfidence.length),
        )
      : null,
  });
  return json;
}

export function wmoDescription(code: number): string {
  const map: Record<number, string> = {
    0: "Klar",
    1: "Überwiegend klar",
    2: "Teilweise bewölkt",
    3: "Bedeckt",
    45: "Nebel",
    48: "Reifnebel",
    51: "Leichter Nieselregen",
    53: "Mäßiger Nieselregen",
    55: "Starker Nieselregen",
    56: "Gefr. Nieselregen leicht",
    57: "Gefr. Nieselregen stark",
    61: "Leichter Regen",
    63: "Mäßiger Regen",
    65: "Starker Regen",
    66: "Gefr. Regen leicht",
    67: "Gefr. Regen stark",
    71: "Leichter Schneefall",
    73: "Mäßiger Schneefall",
    75: "Starker Schneefall",
    77: "Schneegriesel",
    80: "Leichte Regenschauer",
    81: "Mäßige Regenschauer",
    82: "Heftige Regenschauer",
    85: "Leichte Schneeschauer",
    86: "Starke Schneeschauer",
    95: "Gewitter",
    96: "Gewitter mit Hagel",
    99: "Gewitter mit starkem Hagel",
  };
  return map[code] ?? "Unbekannt";
}

export function getContextualDescription(
  code: number,
  hour?: number,
  humidity?: number,
  cloudCoverLow?: number,
): string {
  const h = hour ?? -1;
  const hum = humidity ?? 0;
  const lowCloud = cloudCoverLow ?? 100;

  // Klar / Sonnig: Tag vs. Nacht
  const isNight = h >= 23 || (h >= 0 && h <= 4);
  if (code === 0) return isNight ? "Klare Nacht" : "Sonnig";
  if (code === 1) return isNight ? "Ruhige Nacht" : "Überwiegend sonnig";


  // Morgens
  if (h >= 5 && h <= 9) {
    if (code === 0 && hum >= 90) return "Klarer Morgen mit Bodendunst";
    if (code === 1 && hum >= 85) return "Leicht dunstig, wird sonnig";
    if (code === 45 || code === 48) return lowCloud < 30 ? "Morgennebel, lichtet sich" : "Zäher Nebel";
    if (code === 61 || code === 63) return "Morgendlicher Regen";
  }

  // Tagsüber
  if (h >= 10 && h <= 17) {
    if (code === 0) return "Sonnig";
    if (code === 1) return "Überwiegend sonnig";
    if (code === 2) return "Wechselnd bewölkt";
    if (code === 80 || code === 81 || code === 82) return "Schauer möglich";
    if (code === 95 || code === 96 || code === 99) return "Gewittergefahr";
  }

  // Abends
  if (h >= 18 && h <= 22) {
    if (code === 0) return "Klarer Abend";
    if (code === 1) return "Ruhiger Abend";
    if (code === 95 || code === 96 || code === 99) return "Abendgewitter";
  }

  // Nachts
  if (h >= 23 || (h >= 0 && h <= 4)) {
    if (code === 0) return "Klare Nacht";
    if (code === 1) return "Ruhige Nacht";
    if (code === 2) return "Wolkige Nacht";
    if (code === 3) return "Bedeckte Nacht";
    if (code === 45 || code === 48) return "Nächtlicher Nebel";
    if (code === 51 || code === 53 || code === 55) return "Nieselregen in der Nacht";
    if (code === 61 || code === 63 || code === 65) return "Nächtlicher Regen";
    if (code === 66 || code === 67) return "Gefrierender Regen, Nacht";
    if (code === 71 || code === 73 || code === 75) return "Schneefall in der Nacht";
    if (code === 77) return "Schneegriesel, Nacht";
    if (code === 80 || code === 81 || code === 82) return "Nächtliche Schauer";
    if (code === 85 || code === 86) return "Schneeschauer, Nacht";
    if (code === 95) return "Nachtgewitter";
    if (code === 96 || code === 99) return "Nachtgewitter mit Hagel";
  }

  return wmoDescription(code);
}

export function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** Categorize a WMO code for nowcast bar coloring. */
export function precipKind(code: number): "rain" | "shower" | "snow" | "none" {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([80, 81, 82, 95, 96, 99].includes(code)) return "shower";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67].includes(code)) return "rain";
  return "none";
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function weekdayLabel(iso: string, idx: number): string {
  if (idx === 0) return "Heute";
  if (idx === 1) return "Morgen";
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "long" });
}

