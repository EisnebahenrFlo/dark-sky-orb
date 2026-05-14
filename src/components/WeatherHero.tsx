import { safeFixed } from "@/lib/safeFormat";
import { Wind, Droplets, Gauge, CloudRain, Eye, Thermometer, Cloud, Navigation } from "lucide-react";
import type { CurrentWeather, GeoResult } from "@/lib/weather";
import { wmoDescription, windDirectionLabel } from "@/lib/weather";
import { WeatherIcon } from "./WeatherIcon";
import { RelativeTime } from "./RelativeTime";

interface Props { location: GeoResult; data: CurrentWeather; updatedAt: number }

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
  return (
    <div className="space-y-6">
      <div className="glass relative overflow-hidden rounded-3xl p-8 sm:p-12">
        <div className="absolute -right-16 -top-16 opacity-[0.07]">
          <WeatherIcon code={data.weather_code} isDay={data.is_day} className="h-[28rem] w-[28rem]" />
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
              <WeatherIcon code={data.weather_code} isDay={data.is_day} className="h-14 w-14 text-primary" />
              <div>
                <div className="text-lg font-medium">{wmoDescription(data.weather_code)}</div>
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
