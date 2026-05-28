## Unwetter-Schwellen anpassen

Drei gezielte Änderungen in `src/hooks/useWeatherRisks.ts` — sonst nichts.

### 1) Starkregen — Schwellen + Nowcast-Vorlauf

- Eingang: `max(precipitation[i], precipitation[i+1], precipitation[i+2])` statt nur aktueller Stunde → anrückende Zellen scoren mit.
- Neue Kurve (mm/h → Score):
  - `< 0,5` → 0
  - `0,5–2` → 0–15 (low)
  - `2–10` → 15–40 (moderate)
  - `10–25` → 40–70 (high, ≈ DWD Stufe 2)
  - `25–40` → 70–88 (extreme, Stufe 3)
  - `> 40` → 88–100 (Stufe 4 Unwetter)

### 2) Sturm — Bft-orientierte Schwellen ab 40 km/h

- `< 40` → 0
- `40–60` → 0–25 (Bft 6–7, Windhinweis)
- `60–80` → 25–55 (Sturmböen)
- `80–100` → 55–80 (Sturm)
- `100–120` → 80–92 (schwerer Sturm)
- `> 120` → 92–100 (Orkanböen)

### 3) Hagel — nur bei konvektiver Lage

- Wenn `weather_code ∈ {96, 99}` → fix ≥ 80.
- Sonst nur scoren, wenn `Gewitter-Score ≥ 30`. CAPE + Freezing-Bonus wie bisher, aber gegated.
- Eliminiert das Phantom-„Mäßig"-Hagel bei harmlosem Sommerwetter.

### Out of scope

- Schneesturm, Glatteis, Nebel bleiben unverändert.
- Keine UI-Änderungen, keine neuen Datenfelder.
