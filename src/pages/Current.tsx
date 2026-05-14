import { useWeather } from "@/contexts/WeatherContext";
import { WeatherHero } from "@/components/WeatherHero";
import { LightningPotentialCard } from "@/components/LightningPotentialCard";
import { PageState } from "@/components/PageState";

export function CurrentPage() {
  const { location, dataUpdatedAt } = useWeather();
  return (
    <PageState>
      {(data) => (
        <div className="space-y-6">
          <WeatherHero location={location} data={data.current} updatedAt={dataUpdatedAt} />
          <LightningPotentialCard hourly={data.hourly} />
        </div>
      )}
    </PageState>
  );
}
