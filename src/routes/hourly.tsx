import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/hourly")({
  beforeLoad: () => {
    throw redirect({ to: "/vorhersage" });
  },
});
