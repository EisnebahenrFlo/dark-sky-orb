# Datenqualität verbessern: Stationsdaten für DACH + Italien

## Ziel
Der angezeigte „Jetzt"-Wert (Temperatur, Niederschlag, Wind, Wetterzustand) soll mit der Realität übereinstimmen. Heute kommt alles aus dem Modell **ICON-D2**, das nur alle ~3 h läuft und an einem ~2 km Gitterpunkt interpoliert – nicht am echten Standort gemessen. Lösung: nächstgelegene **Wetterstation** abrufen und ihren Wert als Wahrheit nehmen, Modell nur noch für Vorhersage & Trend.

## Datenquellen (alle kostenlos, kein Key)

| Region | Quelle | Update | Endpoint |
|---|---|---|---|
| DE | Bright Sky (DWD MOSMIX + SYNOP) | 10–60 min | `api.brightsky.dev/current_weather` |
| AT | GeoSphere Austria | 10 min | `dataset.api.hub.geosphere.at` (TAWES) |
| CH | MeteoSwiss SMN OGD | 10 min | `data.geo.admin.ch` (ogd-smn) |
| IT | Aviation METAR (Flughäfen) | 30 min | `aviationweather.gov/api/data/metar` |

Fallback überall, wenn keine Station < 25 km: aktuell verwendetes ICON-Modell.

## Architektur

```text
useWeatherData (Modell, hourly/daily)        ── unverändert ──┐
                                                              │
useStationObservation (NEU, current only) ───────────────────►│ merge in WeatherContext
   └─ /api/station?lat&lon&country                            │
        ├─ DE → Bright Sky                                    ▼
        ├─ AT → GeoSphere                              data.current = {
        ├─ CH → MeteoSwiss                               ...modelCurrent,
        ├─ IT → METAR nearest airport                    ...stationOverride,
        └─ else → null (Modell bleibt Quelle)             source: "station"|"model",
                                                          stationName, stationDistKm
                                                        }
```

## Umsetzungsschritte

1. **`api/station.ts`** (neuer Vercel Serverless Endpoint)
   - Input: `lat`, `lon`, `country`
   - Routing nach `country` zur passenden Quelle, einheitliches Response-Schema:
     `{ temperature, apparentTemperature, humidity, windSpeed, windGust, windDirection, pressure, precipitation10min, weatherCode, observedAt, stationName, stationDistanceKm }`
   - 5-min In-Memory Cache (Reuse `api/_lib/cache.ts`)
   - Bei METAR: nächsten ICAO via statischer Flughafen-Liste DACH+IT (ca. 80 Einträge, eingebettet)

2. **`src/hooks/useStationObservation.ts`** (neu)
   - React-Query, `staleTime` 5 min, `refetchInterval` 5 min
   - Liefert `{ data, isStale, source, ageMinutes }`

3. **`WeatherContext` erweitern**
   - Station-Hook parallel zu `useWeatherData` aufrufen
   - Wenn Station < 25 km **und** Observation < 30 min alt: `current.temperature/humidity/wind/precipitation/weather_code` überschreiben
   - Felder, die nur das Modell hat (UV, CAPE, Geopotential …), bleiben aus dem Modell
   - Neues Feld `data.current._source = "station" | "model"` + `_station = { name, distanceKm, ageMin }`

4. **Plausibilitätsregeln in `getEffectiveCode`** (Erweiterung)
   - Wenn Stations-Niederschlag = 0 mm/10 min UND Modell sagt Regen → Code → Wolke
   - Wenn Stations-Sichtweite > 5 km UND Modell sagt Nebel (45/48) → Code → 3
   - Stations-Temperatur weicht > 3 °C von Modell ab → Stationswert gewinnt, Modell-Hourly bleibt für Verlauf

5. **UI-Mini-Anzeige im `WeatherHero`**
   - Unter dem Temperaturwert: kleines Badge „Messstation Berlin-Tempelhof · vor 8 Min · 4,2 km" (klickbar → Tooltip mit Quelle)
   - Bei Modell-Fallback: „Modellwert ICON-D2"
   - Zeigt sofort, ob Wert „echt" oder „berechnet" ist → erklärt Diskrepanzen statt sie zu verstecken

6. **Konfidenz im bestehenden `ConfidenceBadge`**
   - Score +20 wenn Stationsbeleg vorhanden und < 15 min alt
   - Score −15 wenn Modell und Station um > 3 °C / > 5 mm auseinander

## Was sich für den Nutzer ändert
- „Jetzt"-Temperatur kommt aus echter Messung (typ. Abweichung 0,3 °C statt 1,5–2 °C)
- Regen-Icon und Beschreibung stimmen mit dem überein, was draußen tatsächlich passiert
- Vorhersage (stündlich/täglich) bleibt unverändert ICON-basiert
- Sichtbares Vertrauenssignal: Messstation + Alter sichtbar

## Nicht im Scope
- Multi-Model-Ensemble (separates späteres Projekt)
- Bias-Korrektur der stündlichen Vorhersage (komplex, separat)
- Stationen außerhalb DACH+IT (Modell-Fallback)
- Historische Stationsdaten / Verläufe
