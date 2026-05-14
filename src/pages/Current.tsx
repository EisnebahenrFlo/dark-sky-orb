import { useWeather } from "@/contexts/WeatherContext";
import { WeatherHero } from "@/components/WeatherHero";
import { PageState } from "@/components/PageState";

export function CurrentPage() {
  const { location, dataUpdatedAt } = useWeather();
  return (
    <PageState>
      {(data) => <WeatherHero location={location} data={data.current} updatedAt={dataUpdatedAt} />}
    </PageState>
  );
}
