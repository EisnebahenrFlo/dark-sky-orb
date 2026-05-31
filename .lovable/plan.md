## Ziel
Die „Aktuell“-Ansicht soll den realen Ist-Zustand sauber anzeigen: schönes/trockenes Wetter darf nicht als Regen oder Gewitter erscheinen, während echte aktuelle Niederschläge weiterhin korrekt priorisiert werden.

## Festgestellte Hauptprobleme
1. **Gewitter-Code wird nie zurückgestuft**
   - `getEffectiveCode()` schützt WMO 95/96/99 pauschal vor Downgrade.
   - Dadurch kann ein Gewitter-Code aus Stundenmodell/Nowcast/Warnlogik im Hero stehen bleiben, obwohl Station und aktueller Niederschlag trocken sind.

2. **`reconcileCurrentWithHourly()` übernimmt Stunden-Gewitter zu direkt**
   - Wenn die nächste/aktuelle Modellstunde Gewitter sagt, wird `current.weather_code` sofort auf Gewitter gesetzt.
   - Es fehlt eine Plausibilitätsprüfung: aktueller Niederschlag, Station, LPI/Score, Nowcast-Zelle wirklich aktuell oder nur später?

3. **Nowcast/Rainbow überschreibt den Hero auch bei zukünftigem Regen**
   - `applyRainbowEvidence()` nutzt die Spitze der nächsten 60 Minuten für den aktuellen Hero-Code.
   - Das ist gut für Warnhinweise, aber schlecht für „Aktuell“: wenn die Zelle erst später kommt, darf der Hero nicht so aussehen, als regne/gewittere es jetzt.

4. **Risiko-Ringe in „Aktuell“ zeigen Vorhersagerisiken wie Ist-Zustand**
   - `useWeatherRisks()` nutzt beim Gewitter 48h und bei Starkregen aktuelle + nächste 2 Stunden.
   - In der „Aktuell“-Ansicht wirkt das wie „es ist jetzt Gewitter/Regen“, obwohl es nur ein Vorhersage-/Risikofenster ist.

5. **Stationsdaten werden nicht stark genug als Trockenheits-Evidenz genutzt**
   - Bright Sky liefert oft `precipitation_10min = 0` und aktuellen Stations-WMO-Code trocken.
   - Diese Evidenz sollte Hero-Gewitter/Regen stärker verhindern, außer Radar/Nowcast zeigt aktuell eindeutigen Niederschlag.

## Umsetzung
1. **Aktuellen Ist-Zustand von Kurzfrist-Risiko trennen**
   - Hero-Code nur durch aktuelle Evidenz ändern:
     - Stations-WMO/Niederschlag jetzt
     - `current.precipitation`
     - aktuell laufender Rainbow-Slot
     - aktueller minutely_15-Slot
   - Zukünftige Niederschläge bleiben in Niederschlagskachel/Nowcast, aber überschreiben nicht automatisch Hero-Icon und Hero-Text.

2. **Plausibilitäts-Gate für Gewitter im Hero einbauen**
   - Gewitter im Hero nur anzeigen, wenn mindestens eine dieser Bedingungen erfüllt ist:
     - aktueller WMO-Code 95/96/99 von Station oder Current-Modell plus Niederschlag/Nowcast
     - Rainbow/Nowcast aktuell mit starkem konvektivem Niederschlag
     - sehr starker Gewitter-Score/LPI in der aktuellen Stunde, nicht nur später im Zeitraum
     - amtliche aktive Gewitterwarnung plus passende Niederschlag-/Konvektionssignale
   - Sonst wird auf Regen/Schauer/Bewölkung/Sonne zurückgestuft.

3. **`applyRainbowEvidence()` entschärfen**
   - Aktuell laufende Radar-Zelle darf den Hero-Code setzen.
   - Zukünftige Radar-Zelle darf nur:
     - `current.precipitation`/Diagnose für die Niederschlagskachel beeinflussen,
     - die erste Stundenprognose verbessern,
     - aber nicht den aktuellen Hero auf Regen/Gewitter setzen.

4. **`reconcileCurrentWithHourly()` konservativer machen**
   - Stunden-Code nur dann auf `current` übernehmen, wenn er zeitlich wirklich zur aktuellen Stunde passt und Niederschlags-/Konvektions-Evidenz vorhanden ist.
   - Bei trockener Station (`precipitation_10min = 0`, trockener Stationscode, gute Sicht) kein automatisches Hochstufen auf Regen/Gewitter.

5. **`getEffectiveCode()` meteorologisch robuster machen**
   - Gewitter-Code nicht mehr absolut schützen.
   - Gewitter bleibt nur erhalten, wenn aktuelle Evidenz passt; sonst Downgrade analog Regen-Code.

6. **Risiko-Ringe in „Aktuell“ klarer kalibrieren**
   - Gewitter/Starkregen in „Aktuell“ nicht aus 48h bzw. +2h als aktive Ist-Gefahr anzeigen.
   - Entweder aktuelles/kurzes 0–3h-Fenster verwenden oder Label/Score-Filter so anpassen, dass spätere Risiken nicht wie aktuelles Wetter wirken.

7. **Regressionsfälle prüfen**
   - Schönes Wetter mit trockenem Stationswert darf nicht „Gewitter“/„Regen“ zeigen.
   - Zelle in 30–60 Minuten: Hero bleibt aktuell trocken, Niederschlagskachel zeigt kommenden Regen.
   - Aktiver Starkregen jetzt: Hero zeigt Regen/Starkregen.
   - Aktuelles Gewitter mit WMO 95/96/99 oder starkem Nowcast: Hero zeigt Gewitter.

## Betroffene Dateien
- `src/lib/weatherDescription.ts`
- `src/components/WeatherIcon.tsx`
- `src/lib/stationMerge.ts`
- `src/lib/weatherReconciliation.ts`
- `src/components/WeatherHero.tsx`
- `src/hooks/useWeatherRisks.ts`

## Ergebnis
Nach der Änderung zeigt „Aktuell“ wieder den Ist-Zustand, während Nowcast, Warnungen und Risikoanzeigen weiterhin kommende Gefahren abbilden, aber nicht mehr fälschlich das aktuelle schöne Wetter übermalen.