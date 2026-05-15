import { useWeather } from "@/contexts/WeatherContext";
import { WeatherHero } from "@/components/WeatherHero";
import { LightningPotentialCard } from "@/components/LightningPotentialCard";
import { SunPositionCard } from "@/components/current/SunPositionCard";
import { PageState } from "@/components/PageState";

export function CurrentPage() {
  const { location, dataUpdatedAt } = useWeather();
  return (
    <PageState>
      {(data) => (
        <div className="space-y-6">
          <WeatherHero location={location} data={data.current} updatedAt={dataUpdatedAt} />
          {data.daily?.sunrise?.[0] && data.daily?.sunset?.[0] && (
            <SunPositionCard
              sunrise={data.daily.sunrise[0]}
              sunset={data.daily.sunset[0]}
              nextSunrise={data.daily.sunrise[1]}
            />
          )}
          <LightningPotentialCard hourly={data.hourly} />
        </div>
      )}
    </PageState>
  );
}
