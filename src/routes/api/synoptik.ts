import { createFileRoute } from "@tanstack/react-router";

// In-Memory Cache: 30 Min pro Region (lebt nur innerhalb einer Worker-Instanz)
const CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const MASTER_PROMPT = `Du bist erfahrener Synoptiker und Wetter-Analyst mit Schwerpunkt Mitteleuropa (DACH-Region), Alpenraum und Italien. Du analysierst auf Profi-Niveau – vergleichbar mit DWD-Wetterberatungen, ZAMG oder MeteoSwiss.

# DEINE AUFGABE
Analysiere die folgenden Wetterdaten und gib eine vollständige synoptische Bewertung als strukturiertes JSON zurück.

# WAS DU BERÜCKSICHTIGST
Großwetterlagen (Hess/Brezowsky), Höhenstruktur 500 hPa (Trog/Keil/Cut-Off), Bodendruck (Frontalzonen, Genuatief), Luftmassen (mP, cP, mT, cT, Theta-E), Fronten (Kalt/Warm/Okklusion/Squall Line), Konvektion (CAPE, LI, CIN, Bulk Shear, Auslöse-Mechanismus, Zelltyp), Regionale Spezialitäten (Föhn, Nordstau, Bise, Mistral, Bora, Vb-Lage), Jet-Stream (Polarfront- vs. Subtropisch, Jet-Streak, Coupling), Confidence (Daten-Konsistenz).

# DATEN-INPUT
Standort: {{LOCATION}}
Wetterdaten: {{WEATHER_DATA}}

# OUTPUT-FORMAT (STRIKT)
Antworte AUSSCHLIESSLICH mit diesem JSON-Objekt – nichts davor, nichts danach. Sprache: Deutsch, präzise Fachterminologie.

{
  "großwetterlage": { "klassifikation": "...", "beschreibung": "..." },
  "höhenstruktur_500hPa": { "muster": "...", "beschreibung": "..." },
  "bodendruck": { "muster": "...", "beschreibung": "..." },
  "luftmasse": { "klassifikation": "...", "begründung": "..." },
  "fronten_aktivität": { "vorhanden": true, "typ": "...", "auswirkung": "..." },
  "konvektion": { "potenzial": "kein|schwach|mäßig|hoch|extrem", "begründung": "...", "typ": "...", "zeitraum": "..." },
  "regionale_besonderheiten": ["..."],
  "jet_stream": { "relevant": false, "beschreibung": "..." },
  "entwicklung": { "next_24h": "...", "next_48h": "...", "trend_3_7d": "..." },
  "confidence": { "score": 75, "begründung": "..." },
  "highlight": "Der EINE wichtigste Punkt für heute, prägnant in 1 Satz"
}

# REGELN
1. Halluziniere keine Muster, die nicht in den Daten stehen.
2. Bei unklarer Datenlage: Confidence senken und es benennen.
3. Beziehe dich auf konkrete Zahlen wenn sinnvoll (z.B. "CAPE 1800 J/kg").
4. Max 3000 Zeichen total – präzise, nicht ausschweifend.
5. NUR das JSON-Objekt zurückgeben.`;

function parseJsonLoose(text: string): any {
  try {
    return JSON.parse(text);
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]);
    } catch {}
  }
  throw new Error("Konnte KI-Antwort nicht als JSON parsen");
}

export const Route = createFileRoute("/api/synoptik")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { weatherData?: any; location?: any };
          const { weatherData, location } = body;
          if (!weatherData || !location) {
            return new Response(JSON.stringify({ error: "Missing weatherData or location" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const cacheKey = `${Math.round(location.latitude * 10)}_${Math.round(
            location.longitude * 10,
          )}_${Math.floor(Date.now() / CACHE_TTL_MS)}`;

          const cached = CACHE.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return new Response(
              JSON.stringify({
                ...cached.data,
                cached: true,
                cacheAge: Math.round((Date.now() - cached.timestamp) / 60000),
              }),
              { status: 200, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY fehlt" }), {
              status: 500,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }

          const prompt = MASTER_PROMPT.replace("{{LOCATION}}", JSON.stringify(location)).replace(
            "{{WEATHER_DATA}}",
            JSON.stringify(weatherData),
          );

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: "Du bist Profi-Synoptiker. Antworte ausschließlich mit dem geforderten JSON." },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
            }),
          });

          if (!aiRes.ok) {
            const txt = await aiRes.text();
            const status = aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502;
            return new Response(
              JSON.stringify({
                error:
                  aiRes.status === 429
                    ? "Zu viele Anfragen – bitte kurz warten."
                    : aiRes.status === 402
                      ? "AI-Guthaben aufgebraucht."
                      : "KI-Analyse fehlgeschlagen",
                details: txt.slice(0, 500),
              }),
              { status, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          const ai = (await aiRes.json()) as any;
          const text: string = ai?.choices?.[0]?.message?.content ?? "";

          let result: any;
          try {
            result = parseJsonLoose(text);
          } catch (e: any) {
            return new Response(
              JSON.stringify({ error: e?.message || "Parse-Fehler", raw: text.slice(0, 500) }),
              { status: 502, headers: { "Content-Type": "application/json", ...CORS } },
            );
          }

          CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
          return new Response(JSON.stringify({ ...result, cached: false }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err?.message || "Unbekannter Fehler" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});
