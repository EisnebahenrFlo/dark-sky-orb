import { CalendarDays } from "lucide-react";
import { DailyForecast } from "@/components/DailyForecast";
import { PageState } from "@/components/PageState";
import { useWeather } from "@/contexts/WeatherContext";

export function DailyPage() {
  const { location } = useWeather();
  return (
    <div className="space-y-5">
      <h1 className="sr-only">7-Tage-Vorhersage</h1>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          7-Tage-Vorhersage für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>
      <PageState>{(data) => <DailyForecast daily={data.daily} hourly={data.hourly} current={data.current} />}</PageState>
    </div>
  );
}
