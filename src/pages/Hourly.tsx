import { PageState } from "@/components/PageState";
import { SectionHeader } from "@/components/SectionHeader";
import { HourlyList } from "@/components/hourly/HourlyList";
import { HourlyChart } from "@/components/hourly/HourlyChart";

export function HourlyPage() {
  return (
    <PageState>
      {(data) => (
        <section className="space-y-5">
          <SectionHeader title="Stündlich" subtitle="Nächste 24 Stunden" />
          <HourlyList hourly={data.hourly} daily={data.daily} />
          <HourlyChart hourly={data.hourly} />
        </section>
      )}
    </PageState>
  );
}
