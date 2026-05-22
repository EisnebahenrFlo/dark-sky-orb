import { useWeather } from "@/contexts/WeatherContext";
import { WeatherHero } from "@/components/WeatherHero";
import { SunPositionCard } from "@/components/current/SunPositionCard";
import { WarningIndicatorCard } from "@/components/current/WarningIndicatorCard";
import { UvIndexStat } from "@/components/current/UvIndexStat";
import { LightningPotentialStat } from "@/components/current/LightningPotentialStat";
import { PageState } from "@/components/PageState";

function currentHourIndex(times: string[] | undefined, nowTime: string): number {
  if (!times || times.length === 0) return -1;
  const now = new Date(nowTime).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(new Date(times[i]).getTime() - now);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

export function CurrentPage() {
  const { location, dataUpdatedAt } = useWeather();
  return (
    <PageState>
      {(data) => {
        const uv = data.current.uv_index;
        return (
          <div className="space-y-6">
            <WeatherHero location={location} data={data.current} updatedAt={dataUpdatedAt} />
            <WarningIndicatorCard />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <UvIndexStat value={uv} isDay={!!data.current.is_day} />
              {data.hourly && <LightningPotentialStat hourly={data.hourly} />}
            </div>
            {data.daily?.sunrise?.[0] && data.daily?.sunset?.[0] && (
              <SunPositionCard
                sunrise={data.daily.sunrise[0]}
                sunset={data.daily.sunset[0]}
                nextSunrise={data.daily.sunrise[1]}
              />
            )}
          </div>
        );
      }}
    </PageState>
  );
}
