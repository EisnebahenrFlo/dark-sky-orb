import { createFileRoute } from "@tanstack/react-router";
import { AnalyseTabPage } from "@/pages/AnalyseTab";

export const Route = createFileRoute("/analyse")({
  head: () => ({
    meta: [
      { title: "Analyse · MeteoFlo" },
      {
        name: "description",
        content: "Amtliche Warnungen und synoptische KI-Wetteranalyse in einer Ansicht.",
      },
    ],
  }),
  component: AnalyseTabPage,
});
