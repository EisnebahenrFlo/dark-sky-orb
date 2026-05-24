import { Clock } from "lucide-react";
import { PageState } from "@/components/PageState";
import { SectionHeader } from "@/components/SectionHeader";
import { HourlyList } from "@/components/hourly/HourlyList";
import { HourlyForecastChart } from "@/components/hourly/HourlyForecastChart";
import { useWeather } from "@/contexts/WeatherContext";

export function HourlyPage() {
  const { location } = useWeather();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Stündliche Vorhersage für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>
      <PageState>
        {(data) => (
          <section className="space-y-5">
            <SectionHeader title="Stündlich" subtitle="Nächste 24 Stunden" />
            <HourlyList hourly={data.hourly} daily={data.daily} current={data.current} />
            <HourlyForecastChart hourly={data.hourly} daily={data.daily} currentTime={data.current.time} />
          </section>
        )}
      </PageState>
    </div>
  );
}
