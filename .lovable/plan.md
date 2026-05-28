Ich habe die Ursache eingegrenzt: Für Codogno wird ein METAR-Flughafenwert aus Piacenza in 27,7 km Entfernung als „Ground truth“ akzeptiert. Dieser Stationswert setzt Wolken/Wetter auf trocken/sonnig, während Nowcast, Warnungen und Risiko-Logik gleichzeitig Regen/Gewitter melden.

Plan:

1. Stationsdaten nicht mehr zu großzügig als Wahrheit übernehmen
- METAR-Stationen werden nur noch bei kurzer Distanz und frischer Messung für Hero-Zustand/Wettertext genutzt.
- Eine Station in ~27 km Entfernung darf den lokalen Zustand nicht mehr auf „Sonnig“ überschreiben.
- Wenn eine Station wegen Distanz verworfen wird, wird sie nicht mehr als 100%-vertrauenswürdige Anzeige im Hero gezeigt.

2. Niederschlags-/Nowcast-Evidenz vor „Sonnig“ priorisieren
- Der aktuelle Hero-Zustand darf nicht „Sonnig“ anzeigen, wenn lokaler Nowcast oder Minutely-Daten gerade/zeitnah deutlichen Regen melden.
- In diesem Fall wird der Wettercode auf Regen/Schauer statt Sonne gesetzt, damit Text, Icon, Hero-Farbe und Niederschlagskarte zusammenpassen.
- Gewittercodes bleiben weiterhin nicht downgradebar.

3. Konfliktregel einbauen
- Wenn Stationsdaten „trocken/klar“ melden, aber lokale Regen-/Warn-/Nowcast-Daten deutlich dagegen sprechen, gewinnt die lokale Niederschlagslage.
- Ziel: keine Kombination mehr aus „Sonnig“ + „3 aktive Unwetterwarnungen“ + „Regen hält länger als 2h“.

4. Anzeige transparenter machen
- Die Quellenzeile soll nur dann eine Station als maßgeblich zeigen, wenn sie wirklich für den aktuellen Zustand verwendet wird.
- Bei verworfenen/far-away Stationsdaten bleibt der Hero beim lokalen Modell/Nowcast statt eine entfernte Flughafenstation zu suggerieren.

Technische Details:
- Änderung in `src/lib/stationMerge.ts`: Distanz-/Frische-Schwellen source-spezifisch machen und METAR deutlich strenger behandeln.
- Änderung in `src/pages/Current.tsx` oder Hilfslogik: Hero-Current vor dem Rendern mit lokaler Nowcast-/Minutely-Evidenz korrigieren.
- Ggf. kleine Erweiterung in `WeatherHero`: Quelle/Confidence nicht als Stations-Truth anzeigen, wenn Station verworfen oder durch Nowcast überstimmt wurde.
- Danach prüfe ich Codogno und die Heute-Ansicht visuell: Hero, Risiko, Warnung und Nowcast müssen konsistent sein.