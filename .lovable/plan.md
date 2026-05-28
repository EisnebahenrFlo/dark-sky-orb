## Meteorologisches Audit — Befunde nach Durchsicht aller Tabs

Ich habe alle Berechnungs- und Anzeigepfade (Hero, Heute, Hourly, Daily, Nowcast, Analyse, Karte, Risiko-Hooks) gegen meteorologische Standards geprüft. Hier die Befunde nach Priorität, danach der Implementierungsplan.

---

### 🔴 Kritische Datenfehler

**K1. Gewitter-Composite ignoriert LI & CIN trotz Dokumentation**
`useThunderstormRisk.ts → computeHourScore` nimmt `_liVal` / `_cinVal` (Underscore = ungenutzt!) und ruft die definierten `liFactor` / `cinFactor` nie auf. Auch der `daytimeFactor` ist toter Code. Der Composite ist faktisch nur `CAPE + LPI-Bonus + Böen-Bonus`. → Stabile Sperrschichten (hohes CIN) werden ignoriert, der Score überschätzt sommerliche Tage mit viel CAPE aber „Deckel".

**K2. Daily-Tab nutzt ein anderes Modell als Hero/Hourly**
Daily-API-Call: `models=best_match`. Hero/Hourly: 4-Modell-Ensemble (`icon_d2,icon_eu,ecmwf,knmi`). → Tagesmax kann von der stündlichen Kurve abweichen, Tages-Icon kann „sonnig" zeigen während Hourly Gewitter rechnet.

**K3. Daily-Icon ohne effective-code-Logik**
`DailyForecast.tsx` zeigt `daily.weather_code[i]` direkt. Der Cirrus-Downgrade- und Gewitter-Guard-Schutz aus `getEffectiveCode` greift nicht. Tages-Icon kann „bewölkt" zeigen, obwohl es nur Cirren sind — oder umgekehrt „leichter Regen" bei `precipitation_sum = 0`.

**K4. Station-Merge labelt 10-Min-Summe als „aktuelle Stunde"**
`stationMerge.ts` schreibt `obs.precipitation10min` in `current.precipitation`. Das Feld wird woanders als „letzte Stunde" interpretiert (Risiko-Hook, Bewölkungs-Override). → Wert um Faktor ~6 zu klein.

**K5. Nowcast-Icons hardcoded `cloudCover=50`**
`Nowcast.tsx` ruft `EffectiveWeatherIcon` mit `cloudCover={50}`. Damit greift weder der Cirrus-Downgrade noch der Niederschlags-Override sauber. Mini-Icons im Nowcast können falsch klassifizieren.

---

### 🟠 Konsistenz-Probleme

**KO1. Daily vs. Hero divergieren**
Lösung: Daily ebenfalls aus Ensemble ableiten, oder Hero-relevante Daily-Werte (Tagesmax/min, Wind-Max) aus der stündlichen Ensemble-Reihe rekonstruieren.

**KO2. `current.uv_index` nicht im Current-API-Request**
Hero zeigt UV aus `hourly[0]` — bei Stunde 0 = nachts oft 0, aber bei Tagesmitte könnte direkter Current-Wert sinnvoller sein. Open-Meteo unterstützt `uv_index` im current-Block.

**KO3. Visibility fehlt in Hero-Stats**
Bei Nebel/Dunst kein direkter Sichtwert sichtbar, obwohl `hourly.visibility` vorhanden.

---

### 🟡 Fehlende Risiko-Tachos

**R1. Frost / Bodenfrost** — Tachometer bei `temperature_2m_min ≤ 3°C` (Bodenfrost ab Lufttemp ~3°C wahrscheinlich), Eskalation bis −10°C. Wichtig für Landwirtschaft, Straßenglätte.

**R2. Hitze** — Tachometer ab `apparent_temperature ≥ 30°C`. UBA/DWD-relevante Gesundheitsschwellen: 32 / 35 / 38°C. Mit Tropennacht-Erkennung (`temperature_2m_min ≥ 20°C`).

**R3. UV** — `uv_index ≥ 8` ist gesundheitsrelevant (Hautkrebsrisiko). Aktuell nur als Stat-Kachel, nicht als Risiko-Tacho.

---

### 🟢 Beschreibungen / UX

**B1. `getContextualDescription` hat Lücken** — Nacht-Beschreibungen für Schnee, gefrierender Regen, „Teilweise bewölkt", „Aufkommendes Gewitter" fehlen. Fällt auf generisches `wmoDescription` zurück.

**B2. DWD-Warnstufen-Mapping fehlt** — interne 0–100-Scores ohne Bezug zu offiziellen Stufen 1–4. Nutzer können nicht einschätzen „ist 60 viel?".

**B3. Wind in Bft** — Hero/Daily zeigen nur km/h. Bft-Label (Bft 8 = Sturmböen) macht Severity intuitiv erfassbar.

**B4. HourlyForecast-Chart ohne Böen / Gewitter** — `HourlyList` zeigt beides, `HourlyForecast`-Chart nicht. Inkonsistent.

---

## Implementierungsplan

Aufgeteilt in 3 Etappen, jede in sich abgeschlossen testbar.

### Etappe 1 — Kritische Datenfehler beheben (höchste Priorität)

**E1.1 Gewitter-Composite reparieren** (`src/hooks/useThunderstormRisk.ts`)
- `computeHourScore` wirklich mit `liFactor`, `cinFactor`, `daytimeFactor` rechnen lassen.
- Formel: `score = clamp((basis + bonus) × liFactor × cinFactor × daytimeFactor, 0, 100)`.
- LPI bleibt Hauptindikator (wenn vorhanden), CAPE Fallback.

**E1.2 Daily-Konsistenz** (`src/hooks/useWeatherData.ts` + neuer Helper)
- Daily nicht mehr aus separatem `best_match`-Call ableiten, sondern aus Ensemble-Hourly rekonstruieren (Tagesmax/min Temperatur, Tagesmax Wind/Böen, Tages-Niederschlagssumme, dominanter Code, max UV, max PoP).
- Sunrise/Sunset bleiben aus Daily-API (rein astronomisch, modellunabhängig).
- Resultat: Hero/Hourly/Daily basieren garantiert auf demselben Datensatz.

**E1.3 Daily-Icon mit effective-code** (`src/components/DailyForecast.tsx`)
- `daily.weather_code[i]` durch `getEffectiveCode` schicken — mit `precipitation_sum`, `cloud_cover_mean` (aus hourly Tagesmittel).

**E1.4 Station-Merge Niederschlag korrigieren** (`src/lib/stationMerge.ts`)
- 10-Min-Summe behalten, aber neues Feld `current.precipitation_10min`. `current.precipitation` weiter aus Modell (Stundenwert).
- Oder: 10-Min × 6 als Hochrechnung — sauberer ist neues Feld.

**E1.5 Nowcast-Icons mit echten Daten** (`src/components/Nowcast.tsx`)
- `cloudCover` aus den 4 zeitlich passenden Stunden interpolieren statt `50`.

### Etappe 2 — Fehlende Risiken & DWD-Stufen

**E2.1 Frost-Risiko** in `useWeatherRisks.ts`
- Score aus `Math.min(temperature_2m_next24h)`: ≤ 3°C → low, ≤ 0°C → moderate, ≤ −5°C → high, ≤ −10°C → extreme.

**E2.2 Hitze-Risiko**
- Aus `Math.max(apparent_temperature_next24h)`: ≥ 30 → low, ≥ 32 → moderate, ≥ 35 → high, ≥ 38 → extreme.
- Bei Tropennacht (`min ≥ 20`) +20 Punkte Bonus.

**E2.3 UV-Risiko**
- Aus `uv_index_max` heute: ≥ 6 → low (3 ist Mittel, ab 6 hoch), ≥ 8 → moderate, ≥ 11 → high.

**E2.4 DWD-Warnstufen-Mapping** in Tooltip/Sublabel der Tachos
- 0–25 = keine Warnung
- 26–50 = Wetterhinweis (gelb, Stufe 1)
- 51–70 = markante Warnung (orange, Stufe 2)
- 71–88 = Unwetterwarnung (rot, Stufe 3)
- 89–100 = extreme Unwetterwarnung (violett, Stufe 4)
- Anzeige z.B. „Hoch · Stufe 2" auf den Tachos.

### Etappe 3 — Beschreibungs- & UI-Politur

**E3.1 `getContextualDescription` ergänzen** (`src/lib/weather.ts`)
- Nachtlabels für 51–67, 71–77, 80–86, 95–99.
- Tagsüber: „Gewitter zieht auf" bei `code ∈ {95–99}` und `lightning_potential > 5`.
- „Gefrierender Regen" bei 56/57/66/67 explizit hervorheben (kritisch für Verkehr).

**E3.2 Bft-Label** in Wind-Kacheln (Hero + DailyForecast)
- Helper `bftLabel(kmh)` → „Bft 7 · Steifer Wind", „Bft 9 · Sturm".

**E3.3 Visibility-Kachel in Hero-Stats**
- Nur einblenden wenn `visibility < 5000 m`, sonst weglassen (kein Mehrwert bei klarer Sicht).

**E3.4 HourlyForecast-Chart**: Böen-Linie + Gewitter-Marker
- Zweite Linie für `wind_gusts_10m` (gestrichelt).
- Punkt-Marker bei Stunden mit Gewitter-Score > 50.

---

### Geänderte Dateien (Übersicht)

Etappe 1: `useThunderstormRisk.ts`, `useWeatherData.ts`, `weather.ts` (API-Request), neuer Helper `dailyFromHourly.ts`, `DailyForecast.tsx`, `stationMerge.ts`, `Nowcast.tsx`.

Etappe 2: `useWeatherRisks.ts`, `WeatherRiskGauges.tsx` (DWD-Label im Tooltip).

Etappe 3: `weather.ts` (Descriptions), `WeatherHero.tsx` (Bft, Visibility), `DailyForecast.tsx` (Bft), `HourlyForecast.tsx` (Böen/Gewitter), neuer Helper `bft.ts`.

### Außerhalb des Scopes

- KI-Analyse (`/api/synoptik`): Server-seitig, betrifft keine Frontend-Berechnung.
- Karte: Rainbow-Tiles sind Drittanbieter-Layer, unverändert.
- Blitzortung-WebSocket: liefert externe Echtzeit-Daten, keine Berechnung.

### Reihenfolge

Vorschlag: Etappe 1 zuerst (behebt die echten Datenfehler), dann freigeben für Etappe 2 & 3 nach Sichtprüfung. Soll ich alle drei Etappen in einem Rutsch bauen oder Etappe 1 separat?
