
# UI/Layout-Audit aus User-Sicht

Methode: jeden Tab (Heute, Vorhersage, Analyse, Karte, Nowcast) im Code durchgegangen, AppShell + globale States gelesen, Theme-Verhalten und a11y geprüft. Bewertet als jemand, der die App täglich nutzt und auf Mobile + Desktop wechselt.

## 🔴 Kritisch (Funktion / Vertrauen / Konsistenz kaputt)

**K1 — Gestern eingebaute Etappe-3-Änderungen landen in totem Code.**
Bft-Label, Böen-Linie und Gewitter-Marker habe ich in `src/components/HourlyForecast.tsx` geschrieben, aber `Hourly` rendert `src/components/hourly/HourlyForecastChart.tsx` + `HourlyStrip.tsx`. Nichts davon ist sichtbar. Genauso `src/components/Nowcast.tsx` vs. der tatsächlich verwendete `src/pages/Nowcast.tsx` (Hauptcontainer). Konsequenz: aus User-Sicht ist seit gestern nichts neu. Muss in die richtigen Dateien portiert oder die Duplikate gelöscht werden.

**K2 — Drei Segmented Controls, drei Styles, einer davon hardcoded hellblau.**
- `src/pages/Vorhersage.tsx` (Stündlich/7-Tage) und der äußere Tab in `src/pages/Analyse.tsx` (Warnungen/Analyse) nutzen inline-Style `background: "#f0f4f8"` / `color: "#1a2a3a"`. Im Dark-Mode sieht das aus wie ein hellblauer Verbandskasten quer über dem Glas-UI — bricht Theme-Vertrag und Kontrast.
- `src/pages/Nowcast.tsx` nutzt `bg-muted/60` (passt).
- `HourlyForecastChart` Metric-Tabs nutzen `border-border/40 bg-muted/40` (passt).
- `Map` nutzt eine glass-Pill mit `bg-primary`.
Vier Tab-Komponenten = vier Optiken. Ein gemeinsames `<SegmentedControl>` (oder shadcn Tabs) ist überfällig.

**K3 — Suchfeld ohne Label.**
`SearchBar`-Input hat nur `placeholder=`, kein `aria-label` und kein verbundenes `<label>`. Screenreader sagen "Edit". WCAG-Fail.

**K4 — `min-h-screen` statt `min-h-dvh` in AppShell.**
`AppShell` Zeile 90 nutzt `min-h-screen`. Auf iOS/Android springt das Layout, wenn die URL-Bar ein-/ausblendet. Direkt durch `min-h-dvh` ersetzen.

**K5 — Stats-Grid bricht jetzt asymmetrisch.**
`WeatherHeroStats` ist auf Desktop `md:grid-cols-4`. Inhalt: Wind, Richtung, Niederschlag, Bewölkung, Luftfeuchte, Luftdruck, Gefühlt, Sicht (neu) + UV (children) = **9 Kacheln** → 2 volle Reihen + 1 hängende Kachel. Vorher (ohne Sicht) waren es 8 = sauber. Optionen: Sicht in eine Detailkarte verschieben, oder Layout auf `md:grid-cols-3` umstellen, oder Richtung+Wind in einer Kombikachel kombinieren.

**K6 — Header hat keinen `<h1>`, viele Pages auch nicht.**
`<h1>` existiert nur im Hero (Ortsname). Hourly, Daily, Map, Analyse, Nowcast haben keinen `h1` und überspringen direkt zu `h2`. SEO + Screenreader-Navigation leidet. Mindestens pro Route ein semantischer `h1`.

**K7 — Doppeltes Update-Signal.**
Header zeigt globalen Spinner (`Loader2` bei `isFetching`), gleichzeitig hat jede Page ihren eigenen `RefreshButton variant="statusbar"`, und der Hero hat eigene Refresh-Schaltfläche. Drei verschiedene "Daten werden gerade aktualisiert"-Signale, oft gleichzeitig. User weiß nicht, was Quelle der Wahrheit ist.

**K8 — Refresh-Button auf hellem Hero unsichtbar.**
`WeatherHero` rendert `RefreshButton variant="hero"` ohne Kontrastgarantie. Bei `clear-day`-Palette ist der Hintergrund nahezu weiß. Button-Stroke muss aus der `palette.text`-Variable kommen, nicht aus Tailwind-Token.

## 🟠 Wichtig (degradiert UX merklich)

**W1 — Bottom-Nav-Padding auf Desktop unnötig.**
`pb-[calc(env(safe-area-inset-bottom)+9rem)]` auf der Wrapper-Div gilt initial für alle Breakpoints; auf `sm:` wird es überschrieben. Mobile passt; aber 9rem = 144px ist auch dort üppig. Bottom-Nav misst ca. 76px inkl. Padding — `+5rem` reicht.

**W2 — Analyse-Tab Warnungsstufen ausschließlich farbcodiert.**
"Critical" (rot), "Official" (orange), "AI" (amber) unterscheiden sich nur in der Sättigung. Für Farbenblinde nahezu identisch. Es gibt zwar einen Badge mit Zahl, aber nur bei `critical`. Lösung: bei `official`/`ai` einen kleinen Indikator-Dot vor dem Label oder unterschiedliche Icon-Strokes.

**W3 — Daily-DayRow zeigt "—" für Regenwahrscheinlichkeit 0%.**
Bei sonnigen Tagen erscheint ein toter Droplets-Chip mit "—". Wirkt wie fehlende Daten. Komplett ausblenden wenn pop ≤ 0.

**W4 — `HighlightStrip` ungerade bei 3 Items.**
Mobile: `grid-cols-2`, bei 3 Highlights (nass dabei) hängt der dritte allein in der zweiten Reihe. Lösung: `grid-cols-3` auf mobile mit kleinerem Text, oder horizontaler Scroll-Strip.

**W5 — Lange Wind-Sub-Zeile bricht.**
`Wind`-Kachel zeigt jetzt `Bft 4 · Mäßige Brise · NNO · Böen 32`. Bei 4-Spalten-Grid auf 1280px sind das ~200px Breite — Text wrappt in 2 Zeilen, springt zwischen den Kacheln in der Höhe. Kürzer: nur Bft-Zahl + Richtung; volles Label im `title`.

**W6 — Nowcast-Hero in zwei Stufen geladen.**
Erst zeigt `PageState` einen ganzseitigen Loader, dann ist Hero/Stats da, aber `Rainbow.ai`-Strip ist noch `glass h-56 animate-pulse rounded-3xl`. Drei Sekunden lang sieht der User "geladen → leer → geladen". Skeleton sollte vom Anfang an als Strip-Form gezeigt werden, nicht als generischer Block.

**W7 — Fehler-Empty-State ohne Spinner beim Retry.**
"Erneut versuchen" ändert beim Klick weder Text noch Disabled-State. User klickt zweimal, drei Requests laufen.

**W8 — Mobile Bottom-Nav-Tap-Target.**
`Link` in der Bottom-Nav hat keinen `min-h-11`; aktueller Pill ist ca. 48px hoch (durch `py-2 + Icon 22 + Label 10`). Knapp WCAG-konform. Mit `min-h-12` und etwas mehr `gap` deutlich sicherer auf kleinen Geräten.

**W9 — `placeholder:text-muted-foreground/70` im Suchfeld.**
70% Opacity auf `muted-foreground` unterläuft den AA-Kontrast im Dark-Mode. Full token nutzen.

## 🟡 Polish

**P1 — Footer-Links zeigen auf GitHub-Repo.**
`Impressum`/`Datenschutz` öffnen `EisnebahnerFlo/dark-sky-orb/IMPRESSUM.md`. Für Production: eigene Route oder zumindest gerendertes Markdown statt Repo-Tree.

**P2 — Hero Ort-Subtitle abgeschnitten.**
`admin1 · country` mit `truncate` bei vielen Standorten unsichtbar. Auf Mobile in zweite Zeile umbrechen.

**P3 — `LiveBadge` auf Karte ohne Funktion ohne aktive WS-Verbindung.**
Zeigt "live" auch wenn Blitz-Layer nicht aktiv. Nur in Lightning-Tab anzeigen.

**P4 — `WetterNerdsCard`-Disclosure Animation fehlt.**
`open && (...)` ohne Transition, ploppt schlagartig auf. `details/summary` oder Radix Collapsible.

**P5 — `MeteoFlo`-Brand im Header nicht klickbar erkennbar.**
Punkt + uppercase-Text in `text-muted-foreground` — niemand würde dort klicken. Auf Hover/Focus sichtbar machen.

**P6 — `EntwicklungTabs` (24h/48h/3–7T) als pillförmige Mini-Tabs noch eine 5. Variante des Segmented Controls.**
Vereinheitlichen sobald K2 angegangen wird.

**P7 — Footer-DEV-Badge dauerhaft sichtbar.**
`isDevEnvironment()` ist auf der Preview-Domain immer true. Im publizierten Build wird er weg sein — Tatsache vermerken, sonst wird das später unnötig debuggt.

## Vorgeschlagene Reihenfolge

1. **K1 + K2** zuerst zusammen — Etappe-3-Inhalte in die echten Komponenten ziehen UND einheitlichen `SegmentedControl` einführen, da die Tab-Logik in Vorhersage/Analyse sowieso angefasst werden muss.
2. **K3 + K4 + K6** — a11y-Pakete, schnell und unabhängig.
3. **K5 + K7 + K8** — Hero-/Stats-Sanierung (Layout-Räume, ein zentrales Refresh-Signal).
4. Wichtige (W1–W9) als zweiter Batch.
5. Polish optional, je nach Lust.

Sag mir, ob ich mit der vollständigen Reihenfolge weitermachen soll oder zuerst nur **K1 (Etappe-3-Code in die richtigen Dateien)** fixen — das ist der einzige Punkt, bei dem du sofort einen sichtbaren Unterschied im Vorhersage-Tab merken wirst.
