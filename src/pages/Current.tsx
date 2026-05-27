import { useWeather } from "@/contexts/WeatherContext";
import { WeatherHero, WeatherHeroStats } from "@/components/WeatherHero";
import { SunPositionCard } from "@/components/current/SunPositionCard";
import { WarningIndicatorCard } from "@/components/current/WarningIndicatorCard";
import { UvIndexStat } from "@/components/current/UvIndexStat";
import WeatherRiskGauges from "@/components/WeatherRiskGauges";

import { PageState } from "@/components/PageState";

export function CurrentPage({ onRefresh }: { onRefresh?: () => Promise<void> | void } = {}) {
  const { location, dataUpdatedAt } = useWeather();
  return (
    <PageState>
      {(data) => {
        const uv = data.current.uv_index ?? 0;
        return (
          <div>
            <WeatherHero location={location} data={data.current} updatedAt={dataUpdatedAt} onRefresh={onRefresh} />
            <div className="mt-2 empty:mt-0">
              <WeatherRiskGauges />
            </div>
            <div className="mt-2 empty:mt-0">
              <WarningIndicatorCard />
            </div>
            <div className="mt-2">
              <WeatherHeroStats data={data.current} minutely15={data.minutely_15}>
                <UvIndexStat value={uv} isDay={!!data.current.is_day} />
              </WeatherHeroStats>
            </div>
            {data.daily?.sunrise?.[0] && data.daily?.sunset?.[0] && (
              <div className="mt-2">
                <SunPositionCard
                  sunrise={data.daily.sunrise[0]}
                  sunset={data.daily.sunset[0]}
                  nextSunrise={data.daily.sunrise[1]}
                />
              </div>
            )}
          </div>
        );
      }}
    </PageState>
  );
}
