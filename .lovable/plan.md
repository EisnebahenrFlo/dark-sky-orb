## Ziel
Drei UI-Schwächen beheben — alles rein präsentational, keine Datenlogik anfassen.

---

### 1. Header aufräumen — Theme in Menü

**Heute:** Header zeigt Logo, Spinner, Favoriten-Stern und drei nebeneinanderliegende Theme-Buttons (Hell / Dunkel / System). Auf 390px frisst der Theme-Switcher die Hälfte der Aktionsleiste, obwohl es eine Einstellung ist.

**Neu:** Einen einzigen Icon-Button (Sun/Moon je nach aktivem Theme), der ein Popover-Menü öffnet. Im Popover dann die drei Optionen Hell / Dunkel / System untereinander mit Label + Häkchen am aktiven Eintrag. Standard-shadcn `DropdownMenu`.

- `src/components/ThemeToggle.tsx` umbauen von Segmented Control → `DropdownMenu` mit Trigger-Icon (h-9 w-9, ≥44px Touch-Target).
- Aktives Icon wechselt: light → Sun, dark → Moon, system → Monitor.
- Aria-Label: "Farbschema ändern".
- Kein Aufruf in `AppShell.tsx` zu ändern (bleibt `<ThemeToggle />`).

### 2. Tab-Bar überlagert Footer

**Heute:** Footer (Daten von Open-Meteo / Impressum / Version) wird von der fixed Mobile-Tab-Bar überlappt, weil `pb-28` auf dem Shell zu knapp ist, sobald der Footer + Safe-Area dazukommen.

**Neu:** Padding-Bottom des Page-Containers in `AppShell.tsx` so erhöhen, dass Footer + Tab-Bar + Safe-Area Platz haben. Konkret: `pb-36` auf Mobile (statt `pb-28`), und Footer bekommt `pb-[env(safe-area-inset-bottom)]` zusätzlich, damit auf Geräten mit Home-Indicator nichts klemmt. Desktop (`sm:pb-12`) bleibt unverändert.

Optional: Footer-Block in ein eigenes `<div className="mb-[88px] md:mb-0">` wrappen, damit die Logik lokal sichtbar ist.

### 3. Doppelte Loader auf Home

**Heute:** `HeutePage` rendert `CurrentPage` + `NowcastPage` untereinander. Beide hängen am selben `useWeather`-Context und beide zeigen unabhängig `PageState` → `WeatherLoader` mit identischem Text "Lädt Daten für Berlin…". Beim ersten Laden sieht man zwei gleiche Loader-Karten.

**Neu:** Auf der Home-Seite einmal zentral laden:

- `src/pages/Heute.tsx`: `useWeather()` direkt konsumieren. Wenn `isLoading && !data` → einen einzigen `WeatherLoader` rendern. Wenn `isError && !data` → einen einzigen Error-State. Sonst die beiden Sektionen rendern.
- `CurrentPage` und `NowcastPage` rendern ihre internen `PageState`-Wrapper weiter — auf anderen Routen (z. B. zukünftig isoliert) bleiben sie nutzbar. Auf Home werden sie nur sichtbar, wenn Daten da sind, also greift der innere Loader nicht mehr doppelt.

Alternativ minimaler Eingriff: in `NowcastPage` `PageState` durch eine Variante ersetzen, die im Loading-State `null` zurückgibt (also nur die Current-Karte zeigt den Loader). Ich nehme die zentrale Variante in `Heute.tsx`, weil sie auch den "Nowcast für Berlin"-Header während des Loadings unterdrückt.

---

### Geänderte Dateien
- `src/components/ThemeToggle.tsx` — Umbau auf DropdownMenu
- `src/components/AppShell.tsx` — pb erhöhen, Safe-Area am Footer
- `src/pages/Heute.tsx` — zentraler Loader/Error-State

### Out of Scope (für später)
- Hero-Karten-Hierarchie (Temperatur groß)
- Suchleiste kompakter
- Badge-System vereinheitlichen
- DEV-Marker entfernen
