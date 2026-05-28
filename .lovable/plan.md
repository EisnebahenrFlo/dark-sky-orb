# Bewölkung der Station übernehmen

## Problem
„Weizierlein – real klarer Himmel, App zeigt 100 % / bedeckt." Ursache: nach dem Stations-Merge wird `cloud_cover` weiterhin aus dem ICON-Modell genommen. UI-Stellen lesen es direkt:
- `WeatherHeroStats` → Kachel „Bewölkung 100 %"
- `getEffectiveWeather` → leitet Beschreibung & Icon aus `cloud_cover` ab
→ selbst wenn `weather_code` korrigiert wäre, kippt die Tie-Breaker-Logik den Zustand wieder auf „bedeckt".

## Fix in drei Schritten

### 1. Stations-Endpoint um `cloudCover` erweitern (`api/station.ts`)
- **Bright Sky**: `current_weather.cloud_cover` ist direkt verfügbar (0–100 %) – einfach mit übernehmen.
- **METAR**: aus `clouds[]` (FEW=25, SCT=50, BKN=85, OVC=100, CLR/SKC/NCD/NSC=0) den höchsten Layer als Gesamtdeckungsgrad ableiten. Wenn `clouds` fehlt, aus `wxString` herleiten oder `null`.
- Falls die Station keinen Wert hat (z. B. METAR ohne Wolkenangabe), `cloudCover: null` zurückgeben → Modell bleibt Quelle.

### 2. Merge in `src/lib/stationMerge.ts`
- `cloud_cover` überschreiben, wenn `obs.cloudCover != null`.
- `reconcileCode` erweitern: bei `cloudCover < 20` und Modell sagt „bedeckt" (Code 3) → Code 0 oder 1. Bei `cloudCover > 80` und Modell sagt „klar" → Code 3.
- Beim Mergen das `cloudCover` auch dann übernehmen, wenn es z. B. mit Modell-Niederschlag in Konflikt steht – Station ist Wahrheit für sichtbaren Himmel.

### 3. Konsistenz im Frontend
- Keine UI-Änderung nötig: `WeatherHeroStats` liest `data.cloud_cover` aus dem gemergten Objekt, `getEffectiveWeather` ebenfalls. Nach Schritt 2 ist alles korrekt.
- Optional: im Station-Badge zusätzlich Alter zeigen, damit der Nutzer erkennt, ob die Beobachtung wirklich frisch ist (für spätere Debug-Fragen wie diese).

## Bonus-Robustheit (gleiche Iteration)
- Akzeptiere Bright-Sky-Stationen auch bis **35 km** (statt 25 km) – Weizierlein/Mittelfranken hat nicht überall < 25 km Stationsdichte; ICON ist trotzdem schlechter.
- Logge im Endpoint kurz `console.log` mit Stationsname + Distanz, damit du in den Vercel-Logs sehen kannst, welche Station gezogen wurde.

## Nicht im Scope (separat)
- Sub-Stations-Genauigkeit über Sat-basierte Cloud-Layer (würde EUMETSAT brauchen)
- Bias-Korrektur auf die stündliche Vorhersage
