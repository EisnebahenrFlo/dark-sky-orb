import { HourlyForecast } from "@/components/HourlyForecast";
import { PageState } from "@/components/PageState";

export function HourlyPage() {
  return <PageState>{(data) => <HourlyForecast hourly={data.hourly} />}</PageState>;
}
