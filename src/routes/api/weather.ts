import { createFileRoute } from "@tanstack/react-router";
import { corsOptionsResponse, jsonResponse } from "@/lib/apiCors";

export const Route = createFileRoute("/api/weather")({
  server: {
    handlers: {
      OPTIONS: async () => corsOptionsResponse(),
      GET: async ({ request }) => {
        try {
          const src = new URL(request.url);
          const target = new URL("https://api.open-meteo.com/v1/forecast");
          src.searchParams.forEach((value, key) => target.searchParams.set(key, value));
          const res = await fetch(target, { headers: { Accept: "application/json" } });
          const json = await res.json().catch(() => ({}));
          return jsonResponse(json, { status: res.status });
        } catch (error) {
          return jsonResponse({ error: error instanceof Error ? error.message : "Wetterdaten fehlgeschlagen" }, { status: 502 });
        }
      },
    },
  },
});
