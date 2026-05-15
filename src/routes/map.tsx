import { createFileRoute } from "@tanstack/react-router";
import { MapPage } from "@/pages/Map";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Karte · MeteoFlo" },
      { name: "description", content: "Niederschlagsradar und Live-Blitzdetektion." },
    ],
  }),
  component: MapPage,
});
