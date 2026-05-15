import { createFileRoute } from "@tanstack/react-router";
import { HourlyPage } from "@/pages/Hourly";

export const Route = createFileRoute("/hourly")({
  head: () => ({
    meta: [
      { title: "Stündlich · MeteoFlo" },
      { name: "description", content: "Stündliche Vorhersage für die nächsten 48 Stunden." },
    ],
  }),
  component: HourlyPage,
});
