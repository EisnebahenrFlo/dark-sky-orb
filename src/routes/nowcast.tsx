import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/nowcast")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "nowcast" });
  },
});
