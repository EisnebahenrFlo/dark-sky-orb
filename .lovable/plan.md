## Ziel

Die App soll nicht mehr widersprüchliche Wetterlagen anzeigen, z. B. „Sonnig“ trotz Regen/Gewitter-/Warnsignalen. Aktuell, Nowcast, stündlich, täglich, Analyse und Hero müssen dieselbe bereinigte Wetterwahrheit verwenden.

## Befund aus dem Code

1. **Korrektur gilt bisher fast nur für den Hero**
   - `applyNowcastEvidence()` korrigiert nur `current.weather_code`.
   - Stündliche Karten, Tagesforecast, Charts und Analyse nutzen weiterhin teils rohe/abweichende Modellcodes.

2. **Stündlicher Tab ist wahrscheinlich zeitlich falsch ausgerichtet**
   - `HourlyForecastChart` startet bei der aktuellen Stunde.
   - `HourlyStrip` nimmt aber `hourly.time.slice(0, 24)` und kann dadurch vergangene Stunden ab Mitternacht zeigen.
   - Das erzeugt „Vorhersage stimmt nicht“-Eindruck und Inkonsistenzen zwischen Komponenten.

3. **Daily-Code wird aus separatem `best_match` abgeleitet**
   - Die Tageswerte werden zwar teilweise aus dem Ensemble rekonstruiert, der repräsentative Tages-Wettercode kommt aber aus der separaten Long-Term/`best_match`-Hourly-Reihe.
   - Dadurch kann Tagesanzeige etwas anderes zeigen als die stündliche Ensemble-Lage.

4. **Stationen sind noch nicht vollständig als Qualitätsquelle modelliert**
   - Entfernte METAR-Stationen werden nach dem letzten Fix nicht mehr als Hero-Wahrheit übernommen, aber die Datenpipeline hat noch keine klare, zentrale Regel: „Station darf Temperatur/Wind helfen, aber nicht lokale Niederschlags-/Gewitterlage überstimmen“.

5. **Kostenfreie Quellen sind vorhanden, aber nicht sauber priorisiert**
   - Open-Meteo Multi-Model-Ensemble: DWD ICON-D2/ICON-EU, MeteoSwiss ICON-CH, ItaliaMeteo ARPAE ICON-2i, ECMWF/KNMI wo verfügbar.
   - Bright Sky/DWD Stationsdaten für Deutschland.
   - METAR nur vorsichtig, da Flughäfen lokal oft unpassend sind.
   - Nowcast/Radar/Rainbow-Fallbacks sind vorhanden, müssen aber konsistent in alle Tabs einfließen.
   - Offizielle Warnungen/Risikoanalyse sind vorhanden, dürfen aber nicht isoliert neben „Sonnig“ stehen.

## Umsetzungsplan

### 1. Zentrale Wetter-Reconciliation einbauen

Eine gemeinsame Bereinigungsfunktion für `WeatherData` erstellen/erweitern, die nach Fetch, Ensemble, Station und Nowcast einmalig angewendet wird.

Regeln:
- Aktiver oder unmittelbar bevorstehender Niederschlag schlägt „klar/sonnig“.
- Gewittercodes werden nie auf sonnig/bewölkt downgraded.
- Bei `precipitation > 0`, hoher Niederschlagswahrscheinlichkeit oder Nowcast-Regen wird der Code mindestens auf Regen/Schauer gesetzt.
- Bei hoher Gewitterevidenz aus LPI/CAPE/LI/Gusts wird stündlich mindestens „Gewittergefahr“ visualisiert, ohne echte Gewitter zu überbehaupten.
- Station darf klare/trockene Lage nur überschreiben, wenn nah, frisch und nicht im Konflikt mit Nowcast/Modell/Warnsignalen.

### 2. Aktuelle Anzeige, Nowcast und stündliche Prognose synchronisieren

- `current` mit der tatsächlich nächsten/aktuellen stündlichen und minutely Lage abgleichen.
- Den aktuellen Stunden-Slot in `hourly` mit der bereinigten `current`-Lage konsistent halten, soweit sinnvoll.
- `HourlyStrip` auf denselben Startindex wie `HourlyForecastChart` umstellen: ab aktueller/naheliegendster Stunde, nicht ab Array-Anfang.
- Nowcast-Punkte auf zukünftige/aktuelle Zeit filtern, damit keine alten 15-Minuten-Slots angezeigt werden.

### 3. Tagesforecast aus bereinigter stündlicher Lage ableiten

- Repräsentative Tagescodes aus `finalHourly`/bereinigten stündlichen Codes berechnen, nicht aus separatem `best_match`.
- Tages-Niederschlag, Regenwahrscheinlichkeit und Gewitterindikator mit den stündlichen Daten abgleichen.
- Für heute die nächsten Stunden stärker gewichten; vergangene Stunden ignorieren.

### 4. Quellenstrategie kostenfrei optimieren

- Pro Land weiterhin die besten kostenlosen Open-Meteo-Modelle nutzen:
  - DE/AT: ICON-D2 + ICON-EU + ECMWF + KNMI/Harmonie, soweit verfügbar.
  - CH: MeteoSwiss ICON-CH + ICON-D2 + ECMWF + KNMI/Harmonie.
  - IT: ItaliaMeteo ARPAE ICON-2i + ICON-EU + ECMWF + KNMI/Harmonie.
- Falls ein regionales Modell für einen Standort keine Werte liefert, automatisch sauber auf verfügbare Modelle degradieren statt falsche Null-/Sonnigwerte zu erzeugen.
- METAR nur als unterstützende Messquelle verwenden, nicht als alleinige lokale Wetterwahrheit bei größerer Distanz.
- Bright Sky/DWD in Deutschland als Stationsquelle bevorzugen, aber ebenfalls mit Konfliktprüfung gegen Nowcast/Niederschlag.

### 5. Einheitliche Anzeige in allen Tabs

Alle Tabs sollen die bereinigten Felder aus derselben Datenstruktur verwenden:
- Aktuell/Hero
- Heute/Nowcast
- Vorhersage stündlich
- Vorhersage 7 Tage
- Analyse/Warnungen/Risiko
- Karten-/Favoriten-Kompaktanzeigen, soweit sie eigene Fetches nutzen

Dabei werden bestehende UI-Komponenten nur gezielt angepasst, keine neue Oberfläche gebaut.

### 6. Validierung mit kritischen Szenarien

Nach der Umsetzung prüfe ich gezielt diese Fälle:
- Codogno/IT mit entfernter METAR-Station: keine 27-km-Flughafenstation als „Sonnig“-Wahrheit.
- Regen in Minutely/Nowcast: Hero, Hourly, Daily zeigen nicht „Sonnig“.
- Gewitterrisiko/Warnungen: keine widersprüchliche „Sonnig + aktives Unwetter“-Kombination.
- Trockene Schönwetterlage: keine künstliche Überwarnung/Regenanzeige.
- Stündliche Ansicht: Startet ab jetzt und stimmt mit Chart und Tagesansicht überein.

## Technische Änderungen

Betroffene Kernbereiche:
- `src/lib/stationMerge.ts` oder neues zentrales Reconciliation-Modul
- `src/lib/weather.ts`
- `src/lib/modelEnsemble.ts`
- `src/components/hourly/HourlyStrip.tsx`
- `src/components/hourly/HourlyForecastChart.tsx` nur falls nötig
- `src/components/DailyForecast.tsx`
- ggf. Favoriten-/Kompaktfetch, wenn dort noch ungefilterte Open-Meteo-Daten direkt genutzt werden

## Erwartetes Ergebnis

Die App bleibt kostenlos quellenbasiert, nutzt aber eine klare Priorität:

```text
lokaler Nowcast / tatsächlicher Niederschlag
> frische nahe Stationsmessung
> hochauflösendes Regionalmodell
> Multi-Modell-Konsens
> grobe/entfernte Quellen nur unterstützend
```

Dadurch werden aktuelle Anzeige, stündliche Vorhersage und Tagesforecast konsistent und deutlich robuster gegen genau die falschen „Sonnig trotz Unwetter“-Fälle.