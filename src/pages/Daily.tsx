import { DailyForecast } from "@/components/DailyForecast";
import { PageState } from "@/components/PageState";

export function DailyPage() {
  return <PageState>{(data) => <DailyForecast daily={data.daily} />}</PageState>;
}
