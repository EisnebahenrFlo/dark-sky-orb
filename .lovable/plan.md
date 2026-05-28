# Wetterdaten DE zu pessimistisch, Konfidenz fälschlich 100 %

## Verdacht (3 zusammenwirkende Ursachen)

1. **`weather_code`-Aggregation = `severity_mode`**
   `src/lib/modelEnsemble.ts` aggregiert `weather_code` per `severity_mode`: bei Gleichstand gewinnt der **schwerere** Code. Mit 4 Modellen (ICON-D2, ICON-EU, ECMWF, KNMI) hat oft jedes Modell einen anderen Code → alle Gewichte gleich → Tie-Break wählt das **pessimistischste** Modell. Folge: blauer Himmel im Realität, App zeigt „wechselnd bewölkt".

2. **`cloud_cover` 88 % trotz klarem Himmel**
   `cloud_cover` wird per Median aggregiert — das ist eigentlich ok. Aber: ICON-EU und ECMWF haben für Mittel-/Hochwolken (Cirren) regelmäßig hohe Werte, während die Realität bodennah klar ist. Wenn der UI-Wert `cloud_cover` (total) statt `cloud_cover_low` zeigt, wirkt Cirrus-Bewölkung wie Vollbedeckung. Zu prüfen: was rendert die Hero-Karte / Wetter­beschreibung — total oder low?

3. **Konfidenz 100 %**
   In `buildEnsemble` wird `currentConfidence` aus dem **Spread der current-Temperaturen** berechnet. Wenn das Open-Meteo-`current`-Objekt nur für **ein** Modell befüllt ist (Open-Meteo liefert `current` nicht garantiert für alle Modelle), bleibt `currentTemps.length < 2` und der Code fällt auf `hourlyConfidence[0]` zurück. Bei Stunde 0 ist der Spread aber meist 0 K → 100 %. Das erklärt das „100 % sicher"-Badge bei tatsächlich uneindeutiger Lage.

## Untersuchungs­schritte (Build-Modus, in dieser Reihenfolge)

1. **API-Roh­antwort inspizieren** (per `browser--list_network_requests` / `get_network_request_details` für `/api/weather?...&models=icon_d2,icon_eu,ecmwf_ifs025,knmi_harmonie_arome_europe`):
   - Welche `current_*_<model>`-Keys sind tatsächlich befüllt? (Verdacht: ECMWF/KNMI haben kein `current`-Block.)
   - Welche `weather_code_<model>` und `cloud_cover_<model>` melden die 4 Modelle jetzt für Nürnberg?
2. **Render­pfad für Wetterbeschreibung & Bewölkung** in `src/components/WeatherHero.tsx` und `src/lib/weatherDescription.ts` lesen — wird `cloud_cover` oder `cloud_cover_low` gezeigt?
3. **Konfidenz­badge sichtbar machen** (`KISicherheitBadge` / `ConfidenceBadge`): Kontrast & Position prüfen, der User sagt „kaum sichtbar".

## Geplante Code-Änderungen

### A. Ensemble-Aggregation realistischer machen — `src/lib/modelEnsemble.ts`

- **`weather_code` von `severity_mode` → neue Regel `weighted_consensus`**:
  Statt schwersten Code bei Tie zu wählen, den Code des Modells mit **höchstem Gewicht** wählen; bei echtem Gewichts-Tie den **häufigsten** Code (Modus), erst dann Severity als letzter Tie-Break. Hochauflösende Lokal­modelle (ICON-D2) bekommen so Vorrang vor globalen Modellen, die typischer­weise Cirren überschätzen.
- **Severity-Tie-Break dämpfen**: Nur greifen, wenn Gewichts­differenz < 5 % UND beide Codes „relevant" sind. Verhindert, dass ein einsames ECMWF-„overcast" gegen drei klare lokale Vorhersagen gewinnt.

### B. Konfidenz robuster — `src/lib/modelEnsemble.ts`

- `currentConfidence` nicht aus `hourlyConfidence[0]` fallen lassen, sondern aus dem **Mittel der ersten 3 Stunden** (`hourlyConfidence.slice(0,3)`) berechnen, wenn current-Spread mangels Daten 0 ist. Das verhindert das „100 % trotz Modell-Uneinigkeit".
- Zusätzlich: wenn `activeModelCounts[0] < 2`, Konfidenz auf **max. 60 %** clampen — ein Wert allein ist keine hohe Sicherheit.

### C. Bewölkungs­anzeige präziser — `src/lib/weatherDescription.ts` (oder Aufrufstelle in `WeatherHero`)

- Für die Text­beschreibung (`heiter` / `wolkig` / `bedeckt`) primär `cloud_cover_low + 0.5·cloud_cover_mid` heranziehen, nicht `cloud_cover` (total). Cirren­hochwolken sollen nicht „bedeckt" auslösen.
- Den 88-%-Wert in der UI klar als „Bewölkung gesamt (inkl. hoher Wolken)" labeln oder durch den korrigierten Wert ersetzen.

### D. Badge sichtbarer — `src/components/KISicherheitBadge.tsx`

- Kontrast erhöhen (von subtilem `text-muted-foreground` auf `text-foreground` mit Tone-Background); Mindest­größe `size="sm"` statt `xs`.
- Sicher­stellen, dass Tooltip die Modellliste + Temp-Spread zeigt (gibt's in `ConfidenceBadge` schon, in `KISicherheitBadge` nachziehen).

## Risiken / nicht ändern

- ARPAE-Reparatur (vorheriger Turn) bleibt; keine Modell-Liste anfassen.
- Die Aggregations­modi für Temperatur/Wind/PoP bleiben unverändert — die fühlen sich laut User korrekt an.

## Validierung nach Implementierung

1. Reload Home in Nürnberg-Umgebung → Wetter­beschreibung soll „heiter" oder „leicht bewölkt" zeigen.
2. Konfidenz-Badge zeigt einen realistischen Wert (60–85 %), nicht 100 %.
3. Per Browser-DevTools-Network die Roh-API verifizieren, dass die 4 Modelle tatsächlich unterschiedliche `weather_code` liefern, und im Code-Log ausgeben, welcher Code nach neuer Aggregation gewählt wurde.
