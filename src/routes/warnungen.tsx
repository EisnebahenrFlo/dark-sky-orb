import { createFileRoute } from "@tanstack/react-router";
import { WarnungenPage } from "@/pages/Warnungen";

export const Route = createFileRoute("/warnungen")({
  head: () => ({
    meta: [
      { title: "Warnungen · MeteoFlo" },
      {
        name: "description",
        content:
          "KI-gestützte Wetterwarnungen für DACH und Italien: Gewitter, Sturm, Starkregen, Schnee, Hitze.",
      },
    ],
  }),
  component: WarnungenPage,
});
