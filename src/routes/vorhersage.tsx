import { createFileRoute } from "@tanstack/react-router";
import { VorhersagePage } from "@/pages/Vorhersage";

export const Route = createFileRoute("/vorhersage")({
  head: () => ({
    meta: [
      { title: "Vorhersage · MeteoFlo" },
      { name: "description", content: "Stündliche und 7-Tage-Wettervorhersage in einer Ansicht." },
    ],
  }),
  component: VorhersagePage,
});
