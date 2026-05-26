import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/warnungen")({
  beforeLoad: () => {
    throw redirect({ to: "/analyse" });
  },
});
