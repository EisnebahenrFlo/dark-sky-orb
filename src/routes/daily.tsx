import { createFileRoute } from "@tanstack/react-router";
import { DailyPage } from "@/pages/Daily";

export const Route = createFileRoute("/daily")({
  head: () => ({
    meta: [
      { title: "7-Tage · MeteoFlo" },
      { name: "description", content: "7-Tage-Wettervorhersage mit Detail-Ansicht je Tag." },
    ],
  }),
  component: DailyPage,
});
