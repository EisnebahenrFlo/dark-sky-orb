Ich behebe das als Daten-Pipeline-Problem, nicht als Icon-/Text-Einzelfix.

## Ziel
Alle Tabs sollen dieselbe bereinigte Wetterlage verwenden: Heute, Nowcast, Vorhersage stündlich, 7-Tage, Analyse/Risiken und Warnkarten. Wenn Nowcast/Radar aktiven Regen zeigt, darf der Hero nicht „Sonnig“ anzeigen.

## Plan

1. **Echtzeit-Nowcast als zentrale Datenquelle einbinden**
   - Den Rainbow.ai-Nowcast aus dem separaten Nowcast-Tab in die zentrale Weather-Datenbereinigung aufnehmen.
   - Dafür den bestehenden `useRainbowNowcast` entkoppeln, damit er auch im `WeatherProvider` für den aktuell gewählten Standort genutzt werden kann.
   - Ergebnis: Hero, Statistik-Kachel, stündliche Vorschau und Risiken sehen dieselbe Radar-Evidenz wie der Nowcast-Tab.

2. **Nowcast zeitlich korrekt auswerten**
   - `applyNowcastEvidence` arbeitet aktuell auf den ersten Array-Einträgen und nicht zuverlässig auf „jetzt + Zukunft“.
   - Ich stelle die Logik auf Zeitstempel um: nur aktuelle/zukünftige 15-Minuten- bzw. 10-Minuten-Slots werden gewertet.
   - Vergangene Slots dürfen keine aktuelle Anzeige mehr verfälschen.

3. **Aktuelle Wetterlage gegen Live-Regen absichern**
   - Wenn Rainbow/Open-Meteo-Minutely aktuell Regen meldet, wird `current.weather_code` auf Regen/Schauer gesetzt und `current.precipitation` plausibel angehoben.
   - Gewittercodes bleiben weiterhin unangetastet und werden nie auf Sonne/Wolken reduziert.
   - „Sonnig“ ist nur noch möglich, wenn keine aktuelle Niederschlags-Evidenz vorhanden ist.

4. **Stündliche Vorhersage mit Nowcast überblenden**
   - Für die nächsten Stunden werden Radar-/Nowcast-Raten in die stündlichen Niederschlagswerte projiziert.
   - Stündliche Icons und Regenwerte werden dadurch mit dem Nowcast synchronisiert.
   - Das betrifft insbesondere den Fall aus dem Screenshot: Nowcast zeigt starken Regen, während die Stunde/der Hero trocken bleibt.

5. **Tagesprognose aus den final bereinigten Stunden ableiten**
   - 7-Tage-Codes und Tagesniederschlag werden aus den bereits bereinigten Stunden neu abgeleitet.
   - Heute wird stärker nach den kommenden Stunden gewichtet, nicht nach vergangenen Tagesabschnitten.

6. **Stationsdaten sicherer behandeln**
   - METAR bleibt nur unterstützend und darf keine lokale Nowcast-/Modell-Evidenz überschreiben, wenn die Station zu weit weg, zu alt oder widersprüchlich ist.
   - Ich prüfe zusätzlich, dass Distanzanzeige und Override-Entscheidung getrennt bleiben: eine entfernte Station darf sichtbar sein, aber nicht die lokale Wetterlage bestimmen.

7. **Dev-/Preview-Datenfehler beseitigen**
   - In der aktuellen Preview sind `/api/weather` und `/api/rainbow-nowcast` laut Netzwerk-Snapshot mit `503 API not available in dev preview` blockiert.
   - Für Open-Meteo stelle ich auf direkte kostenlose Public-API-Fetches um, wenn kein privater API-Key nötig ist.
   - Für Rainbow bleibt der API-Fallback bestehen: wenn Rainbow nicht erreichbar ist, nutzt die App Open-Meteo-Minutely statt widersprüchlicher/alter Radarwerte.

## Dateien, die ich anfassen würde
- `src/contexts/WeatherContext.tsx`
- `src/hooks/useRainbowNowcast.ts`
- `src/lib/weatherReconciliation.ts`
- `src/lib/stationMerge.ts`
- `src/lib/weather.ts`
- ggf. `src/lib/rainbowNowcast.ts`, `src/components/Nowcast.tsx`, `src/components/WeatherHero.tsx`

## Ergebnis
Nach der Änderung gibt es eine zentrale „bereinigte Wahrheit“: Wenn Nowcast/Regen aktiv ist, zeigen Hero, Heute-Kacheln, Nowcast, stündlich, täglich und Analyse konsistent Regen bzw. Gewitterrisiko statt Sonne.