## Bug

In `src/components/WeatherIcon.tsx` setzt `getEffectiveCode` jeden Niederschlagscode auf „klar/heiter/bewölkt" zurück, sobald `precipitation < 0.05 mm`. `isPrecipCode` umfasst aber auch **95–99 (Gewitter)**. Resultat: Bei Gewitter ohne aktuellen mm-Wert (Radar-Lag, Vorlauf, Zelle in Anmarsch) wird „Sonnig" angezeigt — wie in Leno.

## Fix

Eine Stelle, ein gezielter Eingriff in `src/components/WeatherIcon.tsx`:

1. **Gewitter-Codes (95, 96, 99) niemals downgraden.** In `getEffectiveCode` direkt nach Eintritt prüfen: wenn `code` ∈ {95, 96, 99} → unverändert zurückgeben.
2. Alternativ (und sauberer): `isPrecipCode` belassen, aber den Precip-Override-Block nur ausführen, wenn `!isThunderstormCode(code)`.

Konkret:

```ts
function isThunderstormCode(code: number): boolean {
  return code === 95 || code === 96 || code === 99;
}

export function getEffectiveCode(...) {
  // Nebel-Logik wie bisher ...

  // Gewitter NIE überschreiben — auch bei 0 mm in der aktuellen Stunde
  if (isThunderstormCode(code)) return code;

  if (isPrecipCode(code) && (precipitation ?? 0) < 0.05) {
    // bestehender Cloud-Cover-Fallback
  }
  // Cirrus-Downgrade wie bisher ...
}
```

## Wirkung

- `WeatherHero`, `HourlyRow`, alle Stellen, die `getEffectiveWeather` / `getEffectiveCode` nutzen, zeigen bei `weather_code` 95–99 wieder korrekt Gewitter-Icon + „Gewitter"-Text.
- Drizzle/Regen-Codes (51–67, 80–82) verhalten sich unverändert — der Radar-Lag-Fallback bleibt für diese Codes erhalten.
- Keine API-/Datenflussänderung, kein Risiko für andere Komponenten.

## Geänderte Datei

- `src/components/WeatherIcon.tsx` — `getEffectiveCode` um Gewitter-Guard erweitern.

## Außerhalb des Scopes

- Hagel (kein eigener WMO-Code), Wind, Warn-Logik.
- Änderungen an `weatherDescription.ts` (übernimmt das Ergebnis automatisch).
