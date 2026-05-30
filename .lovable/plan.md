# KI-Wetterhinweise umbenennen + meteorologisches Audit

Zwei Themen in einem Paket: (1) Begriffs-Refactor und (2) gründliches Audit der zwei Risiko-Pipelines, die der User explizit nennt — KI-Hinweise (`api/risk-warnings.ts` + `useRiskWarnings`) und Gewitter-Score (`useThunderstormRisk`).

---

## Teil A — Umbenennung "KI-Warnung" → "KI-Wetterhinweis"

Begriff "Warnung" ist behördlich reserviert (DWD/ZAMG/MeteoSwiss). Wir sind nicht-amtlich → "Wetterhinweis" passt rechtlich und meteorologisch besser.

Betroffene Strings (UI-only, keine API-Felder umbenennen — wir behalten `warnungen_12h` als Datenfeld, ändern nur die Labels):

- `src/pages/Analyse.tsx` — "KI-Auswertung · 12 H" → "KI-Wetterhinweise · 12 H", "Synoptische KI-Risikoeinschätzung" → "Synoptische KI-Hinweise", "1 Warnung/Warnungen" → "1 Hinweis/Hinweise", "KI-Auswertung konnte nicht…" → "KI-Hinweise konnten nicht…", Error-Toast-Titel.
- `src/components/warnings/WarningCard.tsx` — "KI-Analyse · Experimentell" → "KI-Wetterhinweis · Experimentell".
- `src/components/warnings/OfficialWarningsSection.tsx` — "KI-Auswertung unten" → "KI-Hinweise unten".
- `src/components/AppShell.tsx` — Variable `aiWarningCount` → `aiHintCount` (intern, optional).
- `src/components/current/WarningIndicatorCard.tsx` — Hinweis-Texte angleichen.
- `src/components/loaders/WarningsLoader.tsx` — "KI bewertet Lage" bleibt OK.
- `src/lib/meteoFallbacks.ts` — Fallback-Texte ("KI-Antwort", "KI-/Warn-API") konsistent halten.
- Disclaimer in `api/risk-warnings.ts` Prompt + Fallback: "Experimentelle KI-Auswertung. Keine amtliche Warnung." bleibt — ist korrekter Disclaimer.

Keine Änderung an: amtlichen DWD/MeteoAlarm-Warnungen (heißen weiterhin "Warnungen").

---

## Teil B — Audit KI-Wetterhinweis-Pipeline (`api/risk-warnings.ts`)

### Befunde (meteorologisch)

**B1 — Gewitter-Hinweis hängt nur an Score, der serverseitig nur CAPE+LPI+Gust kennt.**  
`computeServerStormScore` ignoriert LI, CIN, Shear, Tageszeit — Inkonsistenz zu `useThunderstormRisk` (Client). Fallback-Pfad liefert dadurch andere Stufen als die UI im Hero. → Server-Fallback muss dieselbe Composite-Logik nutzen (oder Pipeline so umbauen, dass der Client-Score Pflicht ist und ohne ihn kein Gewitter-Hinweis ausgegeben wird).

**B2 — Starkregen-Detection schaut nur auf `hourly.precipitation`.**  
Rainbow-Nowcast (minütlich) und `minutely_15` werden im Prompt nur erwähnt, fließen aber NICHT in `detectWarnings`. 50 mm/h in einer Konvektionszelle, die zwischen zwei vollen Stunden niedergeht, wird verschluckt. → Nowcast-Peak (mm/h projiziert auf 60 min) ergänzend in die Starkregen-Schwelle einfließen lassen.

**B3 — Wind-Schwellen sind nicht Bft-/DWD-konform.**  
Aktuell: 60 / 75 / 90 / 118 km/h. DWD nutzt 50 (Bft 7, markante Böen) / 70 (Sturm) / 90 (schwerer Sturm) / 105 (orkanartig) / 118 (Orkan). → Schwellen auf 50/70/90/118 setzen.

**B4 — Schnee-Schwelle ist zeitlich nicht normalisiert.**  
`>=5 cm im windowHours-Fenster` mit windowHours=48 → 5 cm über zwei Tage triggern Hinweis, was Unsinn ist. DWD-Standard: cm/6 h oder cm/12 h. → Rolling-Max über 6 h und 12 h berechnen.

**B5 — Glätte deckt nur Niederschlag bei T≤0 ab.**  
Vergisst WMO 56/57 (gefr. Sprühregen), 66/67 (gefr. Regen), Reifglätte (T_taupunkt ≥ T_boden, T_boden < 0), Wet-Bulb-Trigger. → Wet-Bulb-basiert + Code-Trigger + Hinweis-Stufe statt fix "warnung".

**B6 — Zeitfenster-Etikettenschwindel.**  
Antwort-Feld heißt `gewitter_risiko_6h`, Score kommt aber aus 48-h-Peak des Client-Hooks. → Entweder Score auf echte 6 h beschränken oder Feld in `gewitter_risiko_window` umbenennen (mit windowHours-Feld).

**B7 — Amtliche Warnungen eskalieren nur Gewitter.**  
Aktive DWD-"Sturm"/"Starkregen"/"Schneefall"-Warnungen werden nicht in die jeweiligen Hinweis-Typen gehoben. → `officialWarnings` typweise gegen `wind`/`regen`/`schnee`/`gewitter` mappen und Stufe ggf. anheben (DWD Stufe 3/4 → unwetter/extrem).

**B8 — Hagel fehlt als eigener Hinweis-Typ.**  
WMO 96/99 und konvektive Lagen (Gewitter-Score ≥ 60 + Freezing-Level < 3000 m) sollten einen eigenen Hagel-Hinweis erzeugen. Aktuell nur im Gewitter-Text "Achte auf Hagel" implizit.

**B9 — Inkonsistenz zu `useWeatherRisks`.**  
Frontend hat 10 Risikoarten (UV, Tropennacht, Glatteis-Wetbulb …). KI-Pipeline hat ~7. → Mindestens die UI-Top-4 müssen ein KI-Hinweis-Pendant haben können (UV-Hinweis ≥ Index 8, Hitze-Hinweis Tropennacht-Bonus, Glatteis-Wetbulb).

**B10 — Server-Fallback (`scoreFromCAPE` als alleiniger Pfad) leitet User in die Irre.**  
Wenn `thunderstormScore` vom Client fehlt (z.B. Cold-Start oder Hook noch nicht ready), bekommt der User einen Hinweis, der nur auf CAPE-Bands beruht — exakt das vom User kritisierte Verhalten. → Wenn Client-Score fehlt: Gewitter-Hinweis unterdrücken statt CAPE-only-Fallback senden.

### Umsetzung Teil B

1. `detectWarnings` umbauen:
   - Wind-Schwellen 50/70/90/118.
   - Starkregen: max(hourly.precipitation, Rainbow-projizierter mm/h-Peak, minutely_15-Peak×4).
   - Schnee: getrennte 6 h- und 12 h-Summen → 5/10/20 cm/12h-Schema.
   - Glätte: Code 56/57/66/67 → markant; wet_bulb ≤ 0 + Niederschlag → warnung; T_min nachts ≤ -3 + Tau ≥ T_boden → Reifglätte-Hinweis.
   - Hagel: neuer Typ aus `weather_code ∈ {96,99}` oder (`thunderstormScore ≥ 60` und `freezing_level_height < 3000` und `cape ≥ 1500`).
2. Amtliche Warnungen pro Typ mappen → eskalierende Stufen-Logik (`mergeOfficialIntoHints`).
3. Server-Score nur als Fallback halten, aber Composite (LI/CIN/Shear/Daytime) statt nur CAPE — Code aus `useThunderstormRisk` in `api/_lib/thunderstormScore.ts` extrahieren und beidseitig importieren (Single Source of Truth). Wenn das nicht geht (ESM-Grenze), beide Implementierungen mit Marker `THUNDERSTORM_SCORE_VERSION` synchron halten.
4. `gewitter_risiko_6h` → `gewitter_risiko` + Feld `window_hours`. Backwards-compat: alten Key parallel mitschicken.
5. Schwellen-/Stufen-Tabelle im Prompt aktualisieren (Titel-Vorlagen + Beschreibungen für neue Stufen/Typen).
6. UI (`WarningCard`, `RiskHero`) muss neue Typen (`hagel`, evtl. `uv`) rendern — Icon + Tone-Mapping ergänzen.

---

## Teil C — Audit Gewitter-Score (`src/hooks/useThunderstormRisk.ts`)

### Befunde

**C1 — `scoreFromLPI` ist toter Code.**  
Exportiert, aber `computeHourScore` nutzt nur `basis = scoreFromCAPE` + LPI-Bonus. Bei vorhandenem LPI sollte LPI die Basis sein, CAPE der Stützwert.

**C2 — Daytime-Faktor erstickt nächtliche MCS/Frontgewitter.**  
Faktor 0.5 zw. 23–05 Uhr; Override nur bei LPI ≥ 8. Realistisch reicht LPI ≥ 3, oder zusätzlich `shear ≥ 15 m/s` (organisierte Lage). → Override-Schwelle senken + Shear-Bedingung.

**C3 — CAPE-Bands flach oben.**  
2500 J/kg → 80, 5000 J/kg → 80. Extreme Lagen (MCS, Derecho) werden klein-skaliert. → Lineare Fortsetzung bis 4500 J/kg → 95.

**C4 — CIN-Faktor dämpft auch bei modelliertem Blitz.**  
Bei LPI ≥ 5 ist Konvektion gemäß Modell schon ausgelöst → CIN sollte dann maximal 0.9 dämpfen, nicht 0.05.

**C5 — Wind-Shear fehlt komplett.**  
0–6 km Bulk-Shear ist der zentrale Indikator für Superzellen/organisierte Multizellen. Server speichert `maxShear` schon — Frontend ignoriert. → `shearFactor` (`>20 m/s ×1.15`, `>15 ×1.08`).

**C6 — Gust-Bonus binär.**  
Nur +5 bei >50 km/h. Squall-Lagen (80–110 km/h) bekommen denselben Bonus wie 55 km/h. → Linear bis +10 bei 100 km/h.

**C7 — Source-Erkennung verwirrt.**  
`hasLPI` triggert bei einem einzigen Wert ≥ 0.5 → ganzer Datensatz wird "lpi"-Source, auch wenn lokal/aktuell LPI=0. Label "Quelle: LPI" in UI ist dann irreführend. → Pro Stunde echte Source berechnen; Series-Source = mode statt boolean.

**C8 — `byDay` nutzt Stunden-Score inkl. daytimeFactor.**  
Tages-Max korreliert dann mit Erwartung "tagsüber peakt es" — was OK ist, aber die Skala lässt nächtliche Lagen kollabieren. → Für `byDay` einen `dayPeakScore` ohne daytime-Faktor mitliefern, damit Wochenansicht echte Konvektionspeaks zeigt.

**C9 — Keine PWAT-/Niederschlags-Verstärkung.**  
Hohe `precipitation` (>10 mm/h) ist Indikator für Starkregen-Gewitter → +Bonus. Aktuell ignoriert.

**C10 — Test-Calibration fehlt.**  
Keine Reference-Cases (z.B. Bernd 2021, München-Hagel 2023) als Snapshot-Test. → Test-Vektoren in `src/hooks/__tests__/useThunderstormRisk.test.ts` (3–4 historische Lagen).

### Umsetzung Teil C

Eine Datei (`useThunderstormRisk.ts`) + Single-Source-Datei (`api/_lib/thunderstormScore.ts`) gemeinsam refaktorieren:

```text
score = clamp01_100(
  base                                  // max(scoreFromCAPE, scoreFromLPI)
  + gustBonus(g)                        // linear 0..10 ab 50 km/h
  + precipBonus(p)                      // +5 ab 10 mm/h
) * liFactor(li)
  * cinFactorGated(cin, lpi)            // bei LPI≥5 floor=0.9
  * shearFactor(shear)                  // 1.0 .. 1.15
  * daytimeFactorGated(t, lpi, shear)   // Override bei LPI≥3 ODER shear≥15
```

Snapshot-Tests + Doku-Header mit Quellen (NWS Convective Outlook Thresholds, DWD COSMO-DE/ICON-D2 Bulletin).

---

## Technische Details (zusammengefasst)

- Neue Datei: `api/_lib/thunderstormScore.ts` (Single Source).  
- Geänderte Dateien: `api/risk-warnings.ts` (detect-Logik + Prompt + Schwellen), `src/hooks/useThunderstormRisk.ts` (Composite-Refactor), `src/hooks/useRiskWarnings.ts` (Typen), `src/lib/meteoFallbacks.ts` (Schwellen synchron).  
- UI-Strings: `Analyse.tsx`, `WarningCard.tsx`, `OfficialWarningsSection.tsx`, `WarningIndicatorCard.tsx`, evtl. `AppShell.tsx`.  
- Neue Icons/Tone-Mappings für `hagel`.  
- API-Schema (`warnungen_12h`, `gewitter_risiko_6h`) bleibt kompatibel; neuer Key `gewitter_risiko` mit `window_hours` zusätzlich.  
- Tests: `useThunderstormRisk.test.ts` mit 3–4 Lagen-Snapshots.

## Reihenfolge der Umsetzung

1. Single-Source `thunderstormScore.ts` + Tests.  
2. `useThunderstormRisk` darauf umstellen.  
3. `api/risk-warnings.ts` neu (Composite + neue Schwellen + Hagel + Glätte + Schnee/h + amtliche Eskalation).  
4. UI-Renames und neuer Hagel-Typ.  
5. Verifikation: Snapshot-Tests grün, Preview-Check für Hero + Analyse-Tab.
