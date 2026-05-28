## 1. iOS-Zoom bei Suchzeile sperren

**Ursache:** Safari zoomt automatisch rein, sobald ein `<input>` fokussiert wird, das eine `font-size < 16px` hat. Unser Suchfeld nutzt `text-sm` (14px).

**Fix (a11y-freundlich, kein Pinch-Zoom-Verbot):**
- `src/components/SearchBar.tsx`: Input bekommt `text-base md:text-sm` — auf Mobile 16px (kein iOS-Zoom), ab `md` wieder 14px für das kompaktere Desktop-Look.
- Sicherheitsnetz für andere Inputs/Selects in der App: globale Regel in `src/styles.css`:
  ```css
  @media (max-width: 767px) {
    input, select, textarea { font-size: 16px; }
  }
  ```
- `index.html` viewport-Meta bleibt unverändert (kein `maximum-scale=1`, damit Nutzer noch zoomen können — wichtig für Barrierefreiheit).

## 2. Tab-Wechsel-Animation überarbeiten

**Aktueller Stand:** Bei jedem Tab-Wechsel läuft 1,3 s lang ein wetterabhängiges Overlay (Wolken, Regen, Schneeflocken, Blitz, Sterne) über die Seite, plus eine Content-Slide-Animation. Das wirkt überladen, langsam und lenkt vom Inhalt ab.

**Neue Richtung — schnell, ruhig, premium:**
- Wetter-Overlays (Regen/Schnee/Blitz/Wolken/Sterne beim Tab-Wechsel) **komplett entfernen**. Diese Effekte gehören in den Hero/Hintergrund der Heute-Seite, nicht in einen Navigationswechsel.
- Eine einzige, einheitliche Content-Transition für alle Tabs:
  - **Fade + leichter Vertikal-Shift** (8 px → 0) mit `cubic-bezier(0.22, 0.61, 0.36, 1)` über **220 ms**.
  - `prefers-reduced-motion`: nur Opacity-Fade über 120 ms, kein Translate.
- Tab-Buttons (Bottom-Nav + Desktop-Pillen) bekommen eine subtile **Active-Pill-Transition**: die Pill „gleitet" beim Wechsel weich von der alten zur neuen Position. Umsetzung: `transition-all duration-300 ease-out` auf dem bestehenden Hintergrund-Span (ohne Layout-ID/Framer — bleibt im Tailwind-Envelope).
- Subtiles **Haptic feedback** (bereits via `haptic("light")` vorhanden) bleibt erhalten.

**Konkrete Datei-Änderungen:**
- `src/components/transitions/WeatherTabTransition.tsx`: stark vereinfachen — alle Overlay-Komponenten und der `showOverlay`-State entfallen. Übrig bleibt ein keyed `<div>` mit einer einzigen `animate-tab-fade`-Klasse.
- `src/styles.css`: alte Keyframes (`content-slide-left`, `content-rise`, `content-fade`, `content-drop`, `content-hard`, `cloud-sweep-*`, `star-twinkle`, `shooting-star`, `rain-drop`, `snow-fall`, `thunder-flash`) entfernen; neue `tab-fade`-Keyframe hinzufügen.
- `src/components/AppShell.tsx`: `transition-all duration-300 ease-out` auf den absoluten Hintergrund-Span der aktiven Tabs (Desktop + Mobile) ergänzen, damit der Pill-Wechsel weich aussieht.

**Was bleibt unverändert:**
- Die wetterabhängigen Animationen im `WeatherHero` (Heute-Tab Hintergrund) — die sind nicht Teil des Tab-Wechsels.
- Page-Übergänge bei Standortwechsel.

### Erwarteter Effekt
- iPhone-Suchzeile zoomt nicht mehr beim Tippen rein.
- Tab-Wechsel fühlt sich ~5× schneller an (220 ms statt 1300 ms), wirkt clean statt verspielt.
