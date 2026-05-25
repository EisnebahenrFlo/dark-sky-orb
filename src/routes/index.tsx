import { createFileRoute } from "@tanstack/react-router";
import { HeutePage } from "@/pages/Heute";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Heute · MeteoFlo" },
      { name: "description", content: "Aktuelles Wetter und Nowcast für deinen Standort." },
    ],
  }),
  component: HeutePage,
});
