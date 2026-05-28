Ich habe die Modellabfragen direkt gegen Open-Meteo verglichen.

Befund:
- Schweiz bricht, weil `icon_ch2` keine gültige Open-Meteo Modell-ID mehr ist. Gültig ist `meteoswiss_icon_ch2` bzw. `meteoswiss_icon_ch1`.
- Für Nürnberg liefern die Modelle tatsächlich extrem hohe `cloud_cover` Werte, aber gleichzeitig `cloud_cover_low=0` und `cloud_cover_mid=0`. Das ist sehr wahrscheinlich hohe Cirrus-Bewölkung: meteorologisch in `total cloud cover`, optisch aber blauer Himmel.
- Der Text wurde schon teilweise bereinigt, aber Hero-Icon, Hero-Hintergrund und einige Stunden-Icons verwenden weiterhin den rohen `weather_code`. Dadurch bleibt das sichtbare Mismatch bestehen.

Plan:
1. Schweizer Modell-ID korrigieren
   - In `getWeatherModels("CH")` `icon_ch2` durch `meteoswiss_icon_ch2` ersetzen.
   - Die Modellgewichte und Labels entsprechend auf `meteoswiss_icon_ch2` aktualisieren, damit Ensemble und Badge weiter korrekt funktionieren.

2. Eine zentrale effektive Code-Logik für die Anzeige nutzen
   - Den bereits berechneten effektiven WMO-Code aus `getEffectiveWeather(...)` nicht nur für Text verwenden, sondern auch für:
     - großes Hero-Icon
     - Hero-Hintergrund/Canvas-Gruppe
     - Palette im Hero
   - Damit zeigen Text, Icon und Hintergrund dieselbe optisch bereinigte Wetterlage.

3. Stundenanzeige angleichen
   - `HourlyRow`, `HourlyStrip` und die kleine `HourlyForecast`-Kachel sollen `cloud_cover_mid` mitgeben und den effektiven Code fürs Icon verwenden.
   - Aktuell nutzt mindestens `HourlyRow` die bereinigte Beschreibung, aber das rohe Icon. Das wird vereinheitlicht.

4. Aktuelle Stunde sauberer ausrichten
   - Für die aktuelle Stunde wird Low/Mid-Cloud nicht pauschal aus Index 0 genommen, sondern passend zur jeweiligen Zeitstunde. Das verhindert, dass falsche Wolkenwerte aus der ersten Forecast-Stunde auf „Jetzt“ durchrutschen.

5. Kurz validieren
   - Direkte Open-Meteo Testabfrage für Schweiz muss mit `meteoswiss_icon_ch2,...` 200 liefern.
   - Raum Nürnberg mit `low=0/mid=0/high≈90–100` muss optisch als sonnig/überwiegend sonnig erscheinen, mit Hinweis auf Gesamtbewölkung inkl. Cirren statt als „bedeckt“.