import { createFileRoute } from "@tanstack/react-router";
import { AnalysePage } from "@/pages/Analyse";

export const Route = createFileRoute("/analyse")({
  head: () => ({
    meta: [
      { title: "Analyse · Meteo" },
      {
        name: "description",
        content: "Synoptische KI-Wetteranalyse: Großwetterlage, Höhenstruktur, Konvektion und Trend.",
      },
    ],
  }),
  component: AnalysePage,
});
