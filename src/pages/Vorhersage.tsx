import { useState } from "react";
import { HourlyPage } from "@/pages/Hourly";
import { DailyPage } from "@/pages/Daily";
import { SegmentedControl } from "@/components/ui/segmented-control";

type View = "hourly" | "daily";

export function VorhersagePage() {
  const [view, setView] = useState<View>("hourly");

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Vorhersage</h1>
      <SegmentedControl<View>
        ariaLabel="Vorhersage-Zeitraum"
        value={view}
        onChange={setView}
        options={[
          { value: "hourly", label: "Stündlich" },
          { value: "daily", label: "7-Tage" },
        ]}
      />
      {view === "hourly" ? <HourlyPage /> : <DailyPage />}
    </div>
  );
}
