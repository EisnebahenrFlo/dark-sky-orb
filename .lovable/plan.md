## Problem

Foto: blauer Himmel mit minimalen Cirren über Weinzierlein. App zeigt aber:
- Icon: Sonne + dicke Wolke (CloudSun für Code 2)
- Text: „Wechselnd bewölkt"
- Bewölkung 0 % (low/mid) — Zusatz „gesamt 88 % inkl. Cirren"
- KI-Sicherheit: 100 %

Die Zahlen (Bewölkung 0 %, Hinweis auf Cirren) sind korrekt. Falsch sind:
1. **`weather_code` bleibt 2/3**, obwohl das Ensemble nur hohe Wolken (Cirren) sieht. WMO-Code 2 basiert auf *Gesamt*bewölkung. `getEffectiveCode` greift aber nur bei Niederschlags-Codes ein — bei „bewölkt"-Codes (2, 3) wird Low-Cloud ignoriert. Folge: Icon + Beschreibung widersprechen der angezeigten 0 %.
2. **Konfidenz 100 %** trotz 4 Modellen, die offenbar unterschiedlich klassifizieren (sonst gäbe es keinen 88 %-Cirren-Widerspruch zwischen Modellen). Die Penalty für Code-Disagreement greift beim aktuellen Wert nicht stark genug, weil `currentConfidence` aus `confidenceFromSpread` der Temperaturen kommt und Code-Penalty nur stundenweise abgezogen wird.

## Lösung

### A) `src/components/WeatherIcon.tsx` — `getEffectiveCode` erweitern

Cirrus-Downgrade für „bewölkt"-Codes hinzufügen, analog zur bestehenden Precip-Logik:

```text
wenn code ∈ {2, 3} und cloudCoverLow definiert:
    effectiveLowMid = cloudCoverLow + 0.5 * (cloudCoverMid ?? 0)
    wenn effectiveLowMid < 12  → 0   (Sonnig/Klar)
    wenn effectiveLowMid < 30  → 1   (Überwiegend sonnig)
    wenn effectiveLowMid < 60  → 2   (Wechselnd bewölkt)
    sonst                       → 3   (Bedeckt)
```

`cloudCoverMid` als optionaler Parameter ergänzen. Aufrufer (`WeatherHero.tsx`, `EffectiveWeatherIcon`, `getEffectiveWeather`) reichen `data.cloud_cover_mid` durch.

Damit liefert das aktuelle Beispiel (low=0, mid=0, high≈88) → Code 0 → Icon „Sonne", Text „Sonnig", konsistent mit der 0 %-Anzeige. Der Sub-Label-Text „gesamt 88 % inkl. Cirren" bleibt als Aufklärung erhalten.

### B) `src/lib/weatherDescription.ts` + `WeatherHero.tsx`

Signatur von `getEffectiveWeather` um `cloudCoverMid` erweitern. `WeatherHero` ruft mit `data.cloud_cover_mid` auf.

### C) `src/lib/modelEnsemble.ts` — Konfidenz schärfen

`currentConfidence`-Fallback heute: wenn nur 1 Modell `current` liefert, mittelt es die ersten 3 Stunden. Das Beispiel zeigt aber 100 %, also stimmen die Temperaturen offenbar gut überein → die `codeDisagreement`-Penalty muss auch in den `current`-Pfad fließen.

Änderung: `currentConfidence` zieht zusätzlich `codePenalty` aus der aktuellen Stunde ab (`mergedHourly.weather_code` aller aktiven Modelle zur Stunde 0 zählen). Bei 4 Modellen mit unterschiedlichen Codes (z. B. ICON-D2=0, ICON-EU=2, ECMWF=3, KNMI=2) → mind. 3 verschiedene Codes → −20 → realistisch 70–80 %.

Zusätzlich: Wenn `effectiveCode` (nach Cirrus-Downgrade) vom rohen `weather_code` abweicht, weitere −10, da Modell und Realität sichtbar auseinanderlaufen.

### D) Keine Änderung an Datenabruf

Die Open-Meteo-Antwort enthält `cloud_cover_low/mid/high` bereits in `hourly` (siehe `weather.ts:330`). Nur die Weitergabe an die Icon/Beschreibungs-Logik fehlt.

## Validierung

Nach Reload Weinzierlein:
- Icon: Sonne (statt CloudSun)
- Text: „Sonnig" (statt „Wechselnd bewölkt")
- Bewölkung 0 %, Sub: „gesamt 88 % inkl. Cirren" (unverändert)
- KI-Sicherheit: 70–85 % (statt 100 %)

## Geänderte Dateien

- `src/components/WeatherIcon.tsx` — Cirrus-Downgrade in `getEffectiveCode`, neuer Param `cloudCoverMid`
- `src/lib/weatherDescription.ts` — Param-Durchreichung
- `src/components/WeatherHero.tsx` — `cloud_cover_mid` an Helfer übergeben
- `src/lib/modelEnsemble.ts` — Code-Penalty + Effective-Code-Penalty in `currentConfidence`
