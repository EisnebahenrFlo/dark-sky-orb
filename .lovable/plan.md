# Meteorologischer Audit · Gewitter & Starkregen

## Befund (was falsch läuft)

Ich habe die komplette Pipeline `WeatherContext → stationMerge → weatherReconciliation → WeatherHero/Hourly/Daily/Nowcast` durchleuchtet. Es gibt **fünf konkrete Bugs**, die exakt das vom Nutzer beschriebene Verhalten erklären:

### Bug 1 — Niederschlags-Upgrade deckelt bei „mäßiger Regen" (Code 63)
`src/lib/stationMerge.ts` → `upgradeForMm()` und `src/lib/weatherReconciliation.ts` → `upgradeForPrecip()`:

```
if (mm >= 2.5) return 63;  // ← Endstation, egal ob 5 mm oder 150 mm
if (mm >= 0.5) return 61;
return 51;
```

Folge: Selbst bei 150 mm/2h vom Rainbow-Nowcast bleibt der Hero-Code bei 63 → Beschreibung „Mäßiger Regen". Es fehlen die Stufen `65` (starker Regen), `80/81/82` (Regenschauer/heftige Schauer) und der Schritt zu `95` bei Starkregen mit Konvektionssignal.

### Bug 2 — Rainbow-Evidenz schaut nur 30 Minuten voraus & deckelt bei 50 mm/h
`applyRainbowEvidence()` summiert nur `nowSec … nowSec + 30*60`, und `projHourMm = Math.min(50, mmNext30 * 2)`. Bei einer Zelle, die in 35 Minuten einschlägt, sieht der Hero davon nichts. Bei 150 mm/2h (≈ 75 mm/h Spitze) wird auf 50 mm gekappt — und durch Bug 1 trotzdem nur Code 63 vergeben.

### Bug 3 — Hero kennt das Gewitter-Signal nur aus dem WMO-Code, nicht aus LPI/CAPE
`reconcileWeatherData()` hebt zwar auf Code 95 an, aber nur wenn:
- `LPI ≥ 3`, **oder**
- `CAPE ≥ 1500 UND LI ≤ −2 UND Böen ≥ 40 km/h`

Das ist für deutsche Sommergewitter zu konservativ (typisches Wärmegewitter: CAPE 800–1200, LI −3 … −5, Böen 25–35 km/h). `useThunderstormRisk` zeigt im Risiko-Gauge „Hoch" — aber der Hero bleibt bei „leichter Regen", weil die Schwellen nicht greifen. Außerdem wird die Schwelle nur auf die `hourly`-Reihe angewandt, nicht auf den aktuellen Slot, wenn `current.weather_code` schon einen Niederschlagscode trägt.

### Bug 4 — minutely_15 LPI wird gar nicht ausgewertet
Open-Meteo liefert `lightning_potential_index` in `minutely_15` (kommt schon im API-Request). `applyNowcastEvidence()` ignoriert das Feld komplett — es addiert nur `precipitation`. Damit verschenken wir die einzige Echtzeit-Blitz-Vorausschau, die wir haben.

### Bug 5 — Offizielle DWD-Gewitterwarnung wirkt nicht auf Hero
`OfficialWarningsContext` weiß, dass eine Gewitter-/Unwetterwarnung aktiv ist, aber `WeatherProvider` fusioniert das nicht in `current.weather_code`. Konsequenz: behördliche Warnung „Markantes Wettergeschehen — Gewitter" läuft, Hero zeigt „Heiter".

---

## Lösung (5 Pakete)

### Paket 1 — Vollständige Niederschlags-Intensitätsstaffel
Neue, gemeinsame Hilfsfunktion `wmoCodeForPrecipRate(mmPerHour, isConvective)` (in `src/lib/weather.ts`), genutzt von `stationMerge.ts` UND `weatherReconciliation.ts`:

| mm/h | konvektiv? | WMO |
|------|-----------|-----|
| < 0.1 | – | unverändert |
| 0.1–0.5 | nein | 51 (leichter Niesel) |
| 0.5–2.5 | nein | 61 (leichter Regen) |
| 2.5–10 | nein | 63 (mäßiger Regen) |
| 10–25 | nein | 65 (starker Regen) |
| ≥ 25 | nein | 65 (starker Regen, Dauer) |
| 2.5–10 | ja | 80 (Regenschauer) |
| 10–25 | ja | 81 (mäßiger Schauer) |
| ≥ 25 | ja | 82 (heftiger Schauer) |
| beliebig | + Blitz/LPI | 95/96/99 |

`isConvective` = LPI ≥ 1 ODER CAPE ≥ 500 J/kg ODER aktive Gewitterwarnung.

### Paket 2 — Rainbow-Evidenz auf 60 Min ausweiten + Peak-Rate verwenden
In `applyRainbowEvidence()`:
- Horizont: 30 → 60 Minuten, plus separate Erfassung der **Spitzen-Rate** (mm/h) statt nur Summe.
- Cap entfernen (statt `Math.min(50, …)` echten Wert weitergeben, im Hourly-Slot auf 80 mm/h harmlos limitieren).
- Klassifikation über `wmoCodeForPrecipRate(peakRate, isConvective)` statt `upgradeForMm(sum)`.
- Wenn `currentlyRaining` UND `peakRate ≥ 10` → Code mindestens 65/81.

### Paket 3 — LPI aus minutely_15 in den aktuellen Code fusionieren
In `applyNowcastEvidence()`:
- `minutely_15.lightning_potential_index` der nächsten 30 Min auswerten.
- Wenn `maxLPI ≥ 2` UND (Niederschlag erwartet ODER current schon Precip-Code) → Code 95.
- Wenn `maxLPI ≥ 5` → Code 96 (Gewitter mit Hagel/Stark).
- Auch wenn aktueller Code „klar" ist, aber LPI hoch + CAPE>500: Code 95 setzen (Frontalsystem im Anmarsch).

### Paket 4 — Gewitter-Schwellen für Mitteleuropa kalibrieren
In `weatherReconciliation.ts` → `thunderEvidence()`:
- LPI-Schwelle: 3 → **2** (DWD-Praxis: LPI ≥ 2 = Blitze möglich)
- CAPE-Pfad: `CAPE ≥ 800 J/kg UND LI ≤ −2` (Böen-Bedingung lockern auf ≥ 25 km/h ODER weglassen — Böen sind ein Begleitsignal, kein Gate)
- Zusätzlicher Pfad: `LI ≤ −5` allein reicht (sehr labile Schichtung)
- Identische Schwellen müssen in `applyEvidenceToCurrent()` greifen, damit der Hero-Slot synchron zum stündlichen Slot eskaliert.

### Paket 5 — Behördliche Warnung als Override in Hero
`WeatherProvider` erhält `useOfficialWarnings()`-Snapshot. In `mergeStationIntoWeather` (oder neuer Schritt `applyOfficialWarningOverride`):
- Aktive Warnung mit `event.includes("Gewitter")` oder `level ≥ 3` → Hero-Code auf mind. 95 anheben (96 bei „Unwetter", 99 bei „extrem").
- Aktive Warnung mit `event.includes("Starkregen")` und `level ≥ 2` → mind. Code 65/82 (je nach `isConvective`).
- Diagnostik-Flag `_diagnostics.warningEscalated = true` zur Nachvollziehbarkeit.

---

## Test-Checkliste nach Implementierung

1. **Standort mit aktivem DWD-Gewitterwarning** (z. B. während Lage X): Hero zeigt Blitz-Icon + „Gewitter", nicht „Heiter".
2. **Rainbow-Nowcast > 50 mm/2h**: Hero-Stat zeigt korrekte mm-Summe **UND** Hero-Beschreibung lautet „Starker Regen" / „Heftige Schauer" (Code ≥ 65/82).
3. **Hourly-Strip**: bei einer Stunde mit LPI ≥ 2 erscheint Gewitter-Icon, auch wenn Modell-Code „leichter Regen" sagt.
4. **Daily-Karte**: ein Tag mit 1 Gewitter-Stunde unter 23 Schönwetter-Stunden zeigt trotzdem Gewitter-Code (worst-case wins — ist schon implementiert, bleibt erhalten).
5. **Analyse-Tab (Risiko-Gauge)**: Score bleibt konsistent mit Hero-Eskalation (gleiche Schwellen).
6. **Klar-Wetter-Standort**: keine False Positives (kein Gewitter ohne LPI/CAPE/Warning).

## Technische Details (für Devs)

- Neue Helper-Funktion `wmoCodeForPrecipRate(mmPerHour, isConvective)` zentral in `src/lib/weather.ts` — Single Source of Truth, ersetzt die zwei `upgradeForMm`/`upgradeForPrecip`-Duplikate.
- `applyOfficialWarningOverride(data, warnings)` als neuer Schritt in `WeatherContext.tsx` zwischen `applyRainbowEvidence` und `reconcileWeatherData`.
- `reconcileWeatherData` muss die kalibrierten Schwellen auf `current` **und** `hourly` anwenden (aktuell nur hourly + current-mirror).
- Keine Änderung an Komponenten (`WeatherHero`, `HourlyStrip`, `DailyForecast`) nötig — alle lesen den Code, der durch die Pipeline kommt.
- Bestehende Tests in `src/lib/__tests__/nowcast.test.ts` und `rainbowNowcast.test.ts` müssen grün bleiben; neue Cases für 150-mm-Szenario + LPI-Eskalation hinzufügen.
