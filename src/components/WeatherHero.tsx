import { safeFixed } from "@/lib/safeFormat";
import { Wind, Droplets, Gauge, CloudRain, Eye, Thermometer, Cloud, Navigation } from "lucide-react";
import type { CurrentWeather, GeoResult } from "@/lib/weather";
import { windDirectionLabel } from "@/lib/weather";
import { getEffectiveWeather } from "@/lib/weatherDescription";
import { EffectiveWeatherIcon } from "./WeatherIcon";
import { RelativeTime } from "./RelativeTime";

interface Props { location: GeoResult; data: CurrentWeather; updatedAt: number }

function iconAnimationStyle(code: number): React.CSSProperties {
  if (code === 0 || code === 1) return { animation: "wh-sun 3s ease-in-out infinite", transformOrigin: "50% 50%" };
  if (code === 2) return { animation: "wh-bob 4s ease-in-out infinite" };
  if (code === 3) return { animation: "wh-fade 5s ease-in-out infinite alternate" };
  if (code >= 71 && code <= 77) return { animation: "wh-snow 3s ease-in-out infinite alternate" };
  if (code >= 61 && code <= 82) return { animation: "wh-rain 2s ease-in-out infinite" };
  if (code >= 95 && code <= 99) return { animation: "wh-flash 1.5s ease-in-out infinite" };
  if (code === 45 || code === 48) return { opacity: 0.85 };
  return {};
}

function getHeroGradient(temp: number): string {
  if (temp < 0) return "linear-gradient(180deg, rgba(219,234,254,0.3) 0%, transparent 60%)";
  if (temp < 10) return "linear-gradient(180deg, rgba(224,242,254,0.25) 0%, transparent 60%)";
  if (temp < 18) return "linear-gradient(180deg, rgba(220,252,231,0.2) 0%, transparent 60%)";
  if (temp < 25) return "linear-gradient(180deg, rgba(254,249,195,0.25) 0%, transparent 60%)";
  return "linear-gradient(180deg, rgba(254,215,170,0.25) 0%, transparent 60%)";
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Wind; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        {label}
      </div>
      <div className="font-display text-3xl font-medium tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function WeatherHero({ location, data, updatedAt }: Props) {
  const effective = getEffectiveWeather(data.weather_code, data.precipitation, data.cloud_cover, data.is_day, data.relative_humidity_2m, new Date(data.time).getHours());
  const iconStyle = iconAnimationStyle(data.weather_code);
  const heroBackground = getHeroGradient(data.temperature_2m);
  return (
    <div className="space-y-6">
      <style>{`
        @keyframes wh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wh-drift { from { transform: translateX(-4px); } to { transform: translateX(4px); } }
        @keyframes wh-pulse { from { opacity: 0.8; } to { opacity: 1; } }
        @keyframes wh-bob { from { transform: translateY(0); } to { transform: translateY(3px); } }
        @keyframes wh-sway { from { transform: rotate(-5deg); } to { transform: rotate(5deg); } }
        @keyframes wh-flicker { 0%, 60%, 100% { opacity: 1; } 70% { opacity: 0.6; } 80% { opacity: 1; } }
      `}</style>
      <div
        className="glass relative overflow-hidden rounded-3xl p-8 sm:p-12"
        style={{ background: heroBackground, transition: "background 1s ease" }}
      >
        <div className="absolute -right-16 -top-16 opacity-[0.07]">
          <EffectiveWeatherIcon code={data.weather_code} precipitation={data.precipitation} cloudCover={data.cloud_cover} isDay={data.is_day} className="h-[28rem] w-[28rem]" />
        </div>
        <div className="relative">
          <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {[location.admin1, location.country].filter(Boolean).join(" · ")}
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">{location.name}</h1>

          <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="font-display text-7xl font-light tabular-nums sm:text-8xl">
              {Math.round(data.temperature_2m)}°
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex" style={iconStyle}>
                <EffectiveWeatherIcon
                  code={data.weather_code}
                  precipitation={data.precipitation}
                  cloudCover={data.cloud_cover}
                  isDay={data.is_day}
                  className="h-14 w-14 text-primary"
                />
              </span>
              <div>
                <div className="text-lg font-medium">{effective.description}</div>
                <div className="text-sm text-muted-foreground">
                  Gefühlt {Math.round(data.apparent_temperature)}°
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            <RelativeTime timestamp={updatedAt} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat
          icon={Wind}
          label="Wind"
          value={`${Math.round(data.wind_speed_10m)} km/h`}
          sub={`${windDirectionLabel(data.wind_direction_10m)} · Böen ${Math.round(data.wind_gusts_10m)} km/h`}
        />
        <div className="glass flex flex-col items-start rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Navigation className="h-3.5 w-3.5" strokeWidth={1.5} /> Richtung
          </div>
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center rounded-full border border-border"
              style={{ transform: `rotate(${data.wind_direction_10m}deg)` }}
            >
              <Navigation className="h-5 w-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <div className="font-display text-2xl tabular-nums">{Math.round(data.wind_direction_10m)}°</div>
              <div className="text-xs text-muted-foreground">{windDirectionLabel(data.wind_direction_10m)}</div>
            </div>
          </div>
        </div>
        <Stat icon={Droplets} label="Luftfeuchte" value={`${data.relative_humidity_2m}%`} />
        <Stat icon={Gauge} label="Luftdruck" value={`${Math.round(data.pressure_msl)} hPa`} />
        <Stat icon={CloudRain} label="Niederschlag" value={`${safeFixed(data.precipitation, 1)} mm`} sub="aktuelle Stunde" />
        <Stat icon={Cloud} label="Bewölkung" value={`${data.cloud_cover}%`} />
        <Stat icon={Thermometer} label="Gefühlt" value={`${Math.round(data.apparent_temperature)}°`} />
        <Stat icon={Eye} label="Tageszeit" value={data.is_day ? "Tag" : "Nacht"} />
      </div>
    </div>
  );
}
