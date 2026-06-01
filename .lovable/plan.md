## Ziel

Mehr Genauigkeit aus den **bestehenden** Datenquellen (Open-Meteo Multi-Model, Bright Sky Stationen, Rainbow Nowcast, Blitzortung) — **ohne** neue Backend-Services oder Pipelines. Hauptfokus: das richtige Symbol/Wetter zur richtigen Zeit anzeigen.

---

## Kernproblem (deine Hauptbeschwerde)

„Sonnig bei Gewitter und andersherum" — das passiert, weil unsere aktuelle `WeatherIcon`-Ableitung den **Modell-Wettercode ignoriert**, sobald `cloud_cover_low < 40 %` ist. Bei Gewitterzellen ist die *tiefe* Bewölkung punktuell, das Modell setzt aber korrekt Code 95. Wir überschreiben ihn dann zu „heiter".

**Andersherum**: Bei Nebel/Hochnebel ist die Bewölkung hoch, aber kein Niederschlag — wir zeigen „bewölkt" obwohl der Code 45 (Nebel) korrekt wäre.

---

## Was wir ändern (3 Hebel, alle ohne neue Pipelines)

### 1. Wettercode-Ableitung repariert (`WeatherIcon.tsx` + neuer Helper)

Statt einer einzigen Heuristik, eine **Prioritäten-Hierarchie**:

```text
Priorität 1: Beobachtete Phänomene (Station/Radar)
  - Bright Sky condition: thunderstorm/hail/snow/fog → übernehmen
  - Rainbow precipType (rain/snow/sleet) bei aktivem Niederschlag → übernehmen
  - Blitzortung-Cluster im 15-km-Radius < 10 min → Code 95 erzwingen

Priorität 2: Modell-Code wenn meteorologisch plausibel
  - Code 95-99 (Gewitter): nur verwerfen wenn ALLE zutreffen:
    CAPE < 100, LI > 0, lightning_potential = 0, Station + Radar trocken
  - Code 45/48 (Nebel): nur verwerfen wenn Sichtweite > 5 km
  - Code 51-67 (Regen/Schnee): nur verwerfen wenn Station + Radar trocken

Priorität 3: Fallback auf Cloud-Cover-Heuristik (heutiges Verhalten)
```

Das löst beide Richtungen: Gewitter werden nicht mehr „weggebügelt", und Nebel/Niederschlag wird nicht mehr fälschlich auf „heiter" gesetzt.

### 2. Modell-Ensemble smarter gewichten (`modelEnsemble.ts`)

Heute: einfacher Mittelwert über `icon_d2, icon_eu, ecmwf_ifs025, knmi_harmonie_arome_europe`.

Neu:
- **Region-adaptive Gewichte**: ICON-D2 bekommt in DE 2× Gewicht (Heimmodell, 2-km-Auflösung), AROME 2× im Alpenraum/Italien, ECMWF konstant als Stabilitätsanker.
- **Median statt Mittelwert** für Temperatur/Wind (robuster gegen Einzelausreißer).
- **Maximum-Wahrscheinlichkeit** für `weather_code` (wenn 2/4 Modelle Gewitter sagen, nicht wegmitteln).
- **Modell-Spread als Konfidenz** in die UI (Badge „hohe/mittlere/niedrige Übereinstimmung").

### 3. Stations-Bias-Korrektur (`stationMerge.ts`)

Pro Stunde Delta zwischen Bright-Sky-Station und Modell für T/RH/Wind berechnen, **gleitender 6-h-Bias** auf die Vorhersage der nächsten 6–12 h anwenden. Reine Mathematik im Frontend, keine Persistierung nötig (LocalStorage reicht für Bias-Verlauf).

### 4. Höhenkorrektur (`stationMerge.ts`)

Wenn Stationshöhe ≠ Standorthöhe (z. B. Berggipfel vs. Talstation), Temperatur mit Standard-Lapse-Rate 0,65 °C/100 m korrigieren. Open-Meteo liefert `elevation` schon mit.

---

## Was wir NICHT bauen

- Keine neuen API-Endpoints (die `/api/*` 404er in den Logs sind bekannt und bleiben optional).
- Kein Edge Function Backend.
- Keine Persistenz/DB.

---

## Betroffene Dateien

- `src/components/WeatherIcon.tsx` — neue Prioritäten-Hierarchie für Code-Ableitung.
- `src/lib/weatherDescription.ts` — Plausibilitäts-Helper (`isCodePlausible(code, ctx)`).
- `src/lib/stationMerge.ts` — Bias-Korrektur, Höhenkorrektur, Station/Radar-Phänomen-Übernahme.
- `src/lib/modelEnsemble.ts` — region-adaptive Gewichte, Median, Max-Vote für Codes.
- `src/hooks/useWeatherData.ts` — Konfidenz aus Modell-Spread durchreichen.
- `src/components/WeatherHero.tsx` — kleine Konfidenz-Anzeige (optional, dezent).

---

## Erfolgs-Check

Nach dem Build prüfen mit Beispielstandorten:
1. **Berlin bei klarer Wetterlage** → Hero zeigt „heiter/sonnig", kein Phantom-Regen.
2. **Standort mit aktivem Gewitter** (Blitzortung-Treffer) → Hero zeigt Gewitter-Icon, auch wenn `cloud_cover_low` lokal niedrig ist.
3. **Berg-Standort** (z. B. Zugspitze) → Temperatur passt zur tatsächlichen Gipfelhöhe, nicht zur Talstation.
