# Suchleiste – Überarbeitung

Vier Stoßrichtungen, alle frontend-/lib-seitig, keine Backend-Änderung nötig.

## 1) Bessere Vorschläge (`src/lib/weather.ts`)

- **Mehr Treffer & weniger Dubletten**: Bei Stadtnamen-Suche `count=10` → `count=20`, danach denselben Dedupe-Filter wie bei PLZ anwenden (`country_code-name-lat/lon` gerundet) und nach `population` sortieren. So verschwinden doppelte „München, BY" Einträge und große Städte landen oben.
- **Fuzzy/Akzent-Toleranz**: Eingabe vor `searchCities` normalisieren (Trim, mehrfache Leerzeichen, optional Diacritics) — Open-Meteo verlangt sonst exakte Schreibweise („Nuernberg" vs „Nürnberg").
- **Admin1-Anzeige präziser**: GeoResult-Subtext zeigt jetzt `admin1 · country` bzw. bei PLZ `PLZ · admin1`. Bei mehreren Treffern mit gleichem Namen wird `admin2`/`admin1` ergänzt, damit „Neustadt" unterscheidbar wird.
- **Längen-Heuristik**: ab 2 Zeichen suchen (wie bisher), aber Debounce von 300 → 250 ms, damit es sich flotter anfühlt.
- **Aborten**: Laufende `fetch`-Requests via `AbortController` abbrechen, wenn der Nutzer weitertippt — verhindert „alte Treffer überschreiben neue".

## 2) Favoriten & Verlauf im Dropdown (`src/components/SearchBar.tsx`)

Aktuell sieht man im leeren Zustand nur "Zuletzt gesucht". Neuer Aufbau, wenn Eingabe leer ist:

```text
┌────────────────────────────────┐
│ ⭐ Favoriten         (max 5)   │
│  • Nürnberg, BY  ✕             │
│  • Zürich, ZH    ✕             │
├────────────────────────────────┤
│ 🕒 Zuletzt gesucht    leeren   │
│  • Wien, W                     │
│  • Bozen, IT                   │
└────────────────────────────────┘
```

- Favoriten werden aus `useFavorites()` gelesen und oben angezeigt, mit Direkt-Entfernen (✕).
- Verlauf darunter, max. 6 Einträge, "leeren" wie bisher.
- Bei aktiver Eingabe ersetzt die Trefferliste beide Sektionen.
- Tastatur-Navigation (↑/↓/Enter) springt über Favoriten + Treffer hinweg.

## 3) Design & UX

- **Klare Hierarchie**: Suchleiste etwas höher (py-2 → py-2.5), Icon-Buttons rechts gruppiert in einem Container mit Trenner, damit GPS-Button + ⌘K-Hinweis nicht mit dem Input-Text konkurrieren.
- **Mobile**: Auf <640 px wird die Trefferliste full-width (vw-basiert via Portal nicht nötig — `absolute inset-x-0` reicht), Touch-Targets min 44 px.
- **Loading-Skeleton** statt nur Spinner: 3 Platzhalter-Zeilen während des Tippens, damit das Dropdown nicht „springt".
- **Empty-State** mit hilfreichen Hinweisen („Versuche PLZ wie 90402 oder Stadtname").
- **Glas-Effekt**: aktueller `glass`-Hintergrund bleibt, aber `ring`-Farbe an Theme-Token (`--primary`) angleichen.

## 4) GPS-Button robuster

- Bei Erfolg sofort schließen + Toast „Standort: Nürnberg übernommen".
- Bei `gpsStatus === "denied"` zeigen wir nicht nur die rote Box, sondern auch einen Link „Im Browser aktivieren" mit kurzer Anleitung (Tooltip).
- Während `loading` wird der Input deaktiviert (Fokusring bleibt).

## Geänderte Dateien

- `src/lib/weather.ts` — `searchCities` (Dedup, AbortController, count=20, Normalisierung).
- `src/components/SearchBar.tsx` — komplette Re-Strukturierung des Dropdowns (Favoriten + Recent + Treffer + Skeleton + Empty-State), aufgeräumtes Header-Layout.
- Keine Änderungen an `AppShell.tsx`, `useFavorites`, `useGeolocation`, oder am Wetter-Code.

## Outside Scope (jetzt nicht)

- Google Places / Algolia statt Open-Meteo Geocoding (würde Connector + Setup verlangen).
- Suche außerhalb DACH/IT (`ALLOWED_COUNTRIES` bleibt).
- Drag-&-Drop der Favoriten-Reihenfolge.
