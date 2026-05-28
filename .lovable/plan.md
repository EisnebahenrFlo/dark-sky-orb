## Ziel

Wettermodell-Daten qualitativ massiv verbessern, indem wir statt **einem** Modell pro Land **4 Modelle parallel** abfragen, daraus einen robusten Konsens bilden und die Modell-Unsicherheit (Spread) als sichtbares Konfidenz-Signal in Hero, Hourly und Daily anzeigen.

## Warum das die Datenqualität fixt

- **Single-Model Bias verschwindet**: Wenn ICON-D2 die Bewölkung zu hoch schätzt, korrigieren IFS + KNMI das.
- **Echte Regenwahrscheinlichkeit**: Statt "Modell sagt 30 % PoP" → "3 von 4 Modellen sehen Regen" = 75 %.
- **Worst-Case für Warnungen**: CAPE/Gewitter werden als Maximum aggregiert → keine verpassten Risiken.
- **Transparenz**: Der Nutzer sieht, wann die Vorhersage wackelt — kein blindes Vertrauen mehr in eine Zahl.

## Modell-Set pro Region

Open-Meteo akzeptiert `&models=a,b,c,d` in **einem** Request — kein zusätzliches Quota.

| Region | Kurzfrist (0–48h, 1 Request) | Mittelfrist (2–7d) |
|---|---|---|
| DE | `icon_d2`, `icon_eu`, `ecmwf_ifs025`, `knmi_harmonie_arome_europe` | `ecmwf_ifs025`, `icon_seamless`, `gfs_seamless` |
| AT | `icon_d2`, `icon_eu`, `arpae_cosmo_2i`, `ecmwf_ifs025` | siehe DE |
| CH | `icon_ch2`, `icon_d2`, `ecmwf_ifs025`, `knmi_harmonie_arome_europe` | siehe DE |
| IT | `italia_meteo_arpae_icon_2i`, `arpae_cosmo_5m`, `icon_eu`, `ecmwf_ifs025` | siehe DE |

## Konsens-Logik (`src/lib/modelEnsemble.ts`)

Pro Zeitstempel & Variable:

- **Temperatur / Apparent / Wind / Druck / Feuchte / Cloud Cover** → **gewichteter Median** (robust gegen Ausreißer).
  Gewichte nach Auflösung: ICON-D2/CH2 = 1.0 · ICON-EU/ARPAE = 0.7 · IFS/HARMONIE = 0.6 · GFS = 0.4
- **Niederschlagsmenge** → Mittelwert über Modelle mit >0; **PoP = Anteil der Modelle mit > 0.1 mm × 100**
- **Weather Code** → Modus unter Top-3 nach Gewicht; bei Pattt der schwerwiegendere (Gewitter > Regen > Schnee > Bewölkt > Klar)
- **CAPE / Lifted Index / Gewitter-Codes (95/96/99)** → **Maximum** (Worst-Case für Warnsystem)
- **UV-Index** → Mittelwert

### Confidence Score (0–100) pro Stunde
Aus normalisiertem Spread:
- Temp σ < 0.8 K **und** PoP-Spread < 20 % → 90–100 ("Sehr sicher")
- Temp σ 0.8–2 K → 70–89 ("Sicher")
- Temp σ 2–4 K → 40–69 ("Mittel")
- Temp σ > 4 K **oder** PoP-Spread > 50 % → < 40 ("Modelle uneinig")

## Reihenfolge der Wahrheit (unverändert)

1. **Station < 35 km, < 90 min** → Override für "Now" (existiert bereits)
2. **Ensemble-Konsens** → für T+1h bis T+7d
3. **Single-Model-Fallback** → wenn nur ein Modell antwortet (Open-Meteo gibt manchmal `null`-Arrays)

## UI-Integration

### `WeatherHero`
Neuer **ConfidenceBadge** neben dem Modell-Label:
> 📊 Konsens · 92% Sicherheit
Tooltip: "ICON-D2, ICON-EU, IFS, KNMI · Spread ±0.8 K"

### `HourlyForecast` / `HourlyChart`
Pro Stundenzeile dezenter Dot/Bar:
- Grün = >80 % Confidence
- Gelb = 50–80 %
- Rot = <50 % ("Vorhersage unsicher")

Bei < 40 % zusätzlich Icon-Hinweis am Wetter-Symbol.

### `DailyForecast`
Pro Tag aggregierte Tages-Confidence (Mittel über 06–21 Uhr). Anzeige als kleiner Balken unter der Temperatur.

## Geänderte / Neue Dateien

**Neu:**
- `src/lib/modelEnsemble.ts` — Median, Modus, Spread, Confidence-Berechnung (+ Unit Tests in `__tests__/`)
- `src/components/ConfidenceBadge.tsx` — wiederverwendbar, drei Größen (sm/md/lg)
- `src/lib/__tests__/modelEnsemble.test.ts`

**Geändert:**
- `src/lib/weather.ts`
  - `getWeatherModel()` → `getWeatherModels()` gibt Array zurück
  - `fetchWeather()` parst `*_icon_d2`, `*_ecmwf_ifs025` etc. Suffixe, baut Modell-Matrix, ruft `buildEnsemble()` auf
  - Rückgabe `WeatherData` erweitert um `_ensemble: { confidence: number[], spread: {...}, models: string[] }`
- `src/lib/stationMerge.ts` — Station-Override setzt Confidence auf 100 für `current`
- `src/components/WeatherHero.tsx` — ConfidenceBadge im Header
- `src/components/hourly/HourlyRow.tsx` + `HourlyChart.tsx` — Confidence-Dot
- `src/components/DailyForecast.tsx` — Tages-Confidence-Balken
- `.lovable/plan.md` — Statusupdate

**Unverändert:**
- `api/weather.ts` (transparenter Proxy reicht — Modell-Liste kommt im Query)
- `api/station.ts`, Stationen-Pipeline (orthogonal)

## Out of Scope

- Eigene Modell-Inferenz (Aufwand ≫ Nutzen)
- DWD-MOSMIX direkt (Bright Sky deckt das)
- Ensemble-Mitglieder als einzelne Layer in der Karte (späteres Feature)
- Machine-Learning-Bias-Correction (erst nach Datensammlung sinnvoll)

## Technische Risiken

- **Open-Meteo Limits**: Multi-Model-Request ist 1 Call und kostet 1 Quota — kein Risiko.
- **`null`-Werte**: Nicht alle Modelle decken jede Stunde / jede Variable. Ensemble ignoriert `null` und gewichtet die verbleibenden neu.
- **Response-Größe**: ~4× größer. Akzeptabel (~150 KB statt 40 KB), bleibt unter 1 MB.
- **Cache**: Bestehender 5-min-Cache im Proxy bleibt wirksam.

## Erfolgskriterium

In Weizierlein bei klarem Himmel:
- Vorher: "Bedeckt 100 %" (ICON-D2 alleine)
- Mit Station-Override: "Klar 5 %"
- Mit Ensemble **ohne** Station: "Heiter 25 % · Confidence 65 %" (weil IFS/KNMI klar sehen, ICON nicht)
- Mit Station **und** Ensemble: "Klar 5 % · Confidence 100 %" (Station bestätigt Mehrheit)
