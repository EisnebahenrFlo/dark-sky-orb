import { createFileRoute } from "@tanstack/react-router";
import { NowcastPage } from "@/pages/Nowcast";

export const Route = createFileRoute("/nowcast")({
  head: () => ({
    meta: [
      { title: "Nowcast · Meteo" },
      { name: "description", content: "Hochaufgelöste Niederschlagsvorhersage für die nächsten Stunden." },
    ],
  }),
  component: NowcastPage,
});
