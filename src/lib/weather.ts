export interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
  admin2?: string;
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
  cloud_cover: number;
  is_day: number;
  uv_index?: number;
  time: string;
}

export interface MinutelyData {
  time: string[];
  precipitation: number[];
  weather_code: number[];
  temperature_2m: number[];
  wind_speed_10m: number[];
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
}

const ALLOWED_COUNTRIES = new Set(["DE", "AT", "CH", "IT"]);

export async function searchCities(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=10&language=de`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Suche fehlgeschlagen");
  const data = await res.json();
  const results: GeoResult[] = data.results ?? [];
  return results.filter((r) => ALLOWED_COUNTRIES.has(r.country_code));
}

function getWeatherModel(countryCode?: string): string {
  switch (countryCode?.toUpperCase()) {
    case "DE": return "icon_d2";
    case "IT": return "italia_meteo_arpae_icon_2i";
    default:   return "best_match";
  }
}

export function getWeatherModelLabel(countryCode?: string): string {
  switch (countryCode?.toUpperCase()) {
    case "DE": return "Kurzzeit: DWD ICON D2 · 2 km · Vorhersage: Open-Meteo Best Match";
    case "AT": return "Kurzzeit: GeoSphere Austria · 2 km · Vorhersage: Open-Meteo Best Match";
    case "CH": return "Kurzzeit: MeteoSwiss ICON CH2 · 1 km · Vorhersage: Open-Meteo Best Match";
    case "IT": return "Kurzzeit: ItaliaMeteo ARPAE · 2 km · Vorhersage: Open-Meteo Best Match";
    default:   return "Datenquelle: Open-Meteo Best Match";
  }
}

export async function fetchWeather(lat: number, lon: number, countryCode?: string): Promise<WeatherData> {
  const shortParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,precipitation,cloud_cover,is_day",
    minutely_15: "precipitation,weather_code,temperature_2m,wind_speed_10m",
    forecast_minutely_15: "24",
    hourly:
      "temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,uv_index,is_day,lightning_potential,dewpoint_2m,cape,lifted_index,convective_inhibition,temperature_850hPa,temperature_700hPa,temperature_500hPa,temperature_300hPa,geopotential_height_500hPa,geopotential_height_850hPa,wind_speed_850hPa,wind_direction_850hPa,wind_speed_500hPa,wind_direction_500hPa,wind_speed_300hPa,wind_direction_300hPa,relative_humidity_850hPa,relative_humidity_700hPa,vertical_velocity_700hPa",
    forecast_hours: "48",
    timezone: "auto",
    models: getWeatherModel(countryCode),
  });

  const longParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
    hourly: "uv_index,is_day",
    forecast_days: "7",
    timezone: "auto",
    models: "best_match",
  });

  const [shortRes, longRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?${shortParams.toString()}`),
    fetch(`https://api.open-meteo.com/v1/forecast?${longParams.toString()}`),
  ]);
  if (!shortRes.ok || !longRes.ok) throw new Error("Wetterdaten fehlgeschlagen");
  const [shortJson, longJson] = (await Promise.all([shortRes.json(), longRes.json()])) as [
    WeatherData,
    WeatherData,
  ];
  const currentUv = getCurrentUvFromLongTerm(shortJson.current.time, longJson.hourly);
  const json: WeatherData = {
    ...shortJson,
    current: {
      ...shortJson.current,
      uv_index: currentUv,
    },
    daily: longJson.daily,
    hourly: {
      ...shortJson.hourly,
      uv_index: longJson.hourly?.uv_index ?? shortJson.hourly?.uv_index,
    },
  };
  // eslint-disable-next-line no-console
  console.log("[weather] models=", { short: getWeatherModel(countryCode), long: "best_match" }, {
    lat,
    lon,
    countryCode,
    hasHourly: !!json.hourly,
    hasDaily: !!json.daily,
    hasMinutely15: !!json.minutely_15,
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
    if (code === 61 || code === 63 || code === 65) return "Nächtlicher Regen";
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
