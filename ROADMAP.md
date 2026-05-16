# Projekt MeteoFlo

**URL:** meteoflo.com
**Preview:** [Lovable Preview](https://preview--meteoflo.lovable.app/)
**Version:** v1.0.0-rc1 → **Release 1.0 geplant: 20.05.2026**

---

## ✅ Status: v1.0 ist Feature-Complete

Alle geplanten Features für 1.0 sind drin. Die wichtigsten Bugs sind gefixt. Reif für den Release.

### 🎉 Implementierte Features

**Kernfunktionen**
- Aktuelles Wetter mit Gewitterpotential
- Nowcast (2h & 6h) mit Niederschlagsart (Regen, Starkregen, Schnee, Graupel, Hagel)
- Stündliche Vorhersage mit Gewitterpotential
- 7-Tage Vorhersage mit Gewitterpotential
- Wetterradar (RainViewer) mit Autoplay
- Native Blitzortung
- UV-Index
- Sonnenstand (Aufgang / Untergang / Verlauf)

**KI-Features**
- Synoptische KI-Wetteranalyse
- KI-Wetter- und Unwetterwarnung (experimentell)
- KI-Gewitter- und Unwetterauswertung

**Warnungen**
- Amtliche Wetterwarnungen DACH (DWD)
- Amtliche Wetterwarnungen Italien (MeteoAlarm) mit DE-Übersetzung
- Warn-Indikator im Tab „Aktuell"

**App & UX**
- ReBrand „MeteoFlo" + eigene Domain meteoflo.com
- Standort-Favoriten
- Splash- und Lade-Screen-Animationen
- Animierter Tab-Wechsel
- Fehler-Splashscreen mit Home-Button
- Dark / Light Mode
- Datenschutz und Impressum

### 🐛 Bugfixes & Polish (Mai 2026)

- Sonnenstand-Design überarbeitet
- Badge zeigte „1" trotz keiner Warnungen → gefixt
- Ladebalken bei KI-Analyse
- Blitzortung Cookie-Fenster behoben
- UI Polish stündliche Vorhersagen
- Wetterradar Darkmode lesbar
- **Karte Wetterradar UND Blitzortung im Darkmode lesbar (Bundle B)**
- Regen-Icon trotz 0,0mm Niederschlag → konsistent
- Wetterradar Zoomstufe + Autoplay funktionieren
- Palermo „Page Not Found" → gefixt
- Standort/Infos bei KI-Warnungen → richtiger Standort
- KI-Analyse aktualisiert bei Standortwechsel
- **Wetterwarnungs-Summary zeigt korrekt amtliche Warnungen (Bundle A)**
- **Grüne MeteoAlarm-Warnungen für Italien werden ausgefiltert (Bundle A)**
- **Blitzortung zeigt jetzt sichtbare Blitze (Bundle B)**

---

## 🔵 Phase 7 — Pre-Release Endspurt (jetzt bis 20.05.)

**Credit-Budget:** 8,8 verbleibend
**Strategie:** Keine größeren Änderungen mehr. Credits-Polster aufheben für Hotfixes, falls im Selbsttest noch was Kritisches auftaucht. Polish kommt nach dem Release.

### To-Do bis Release

- [ ] Selbsttest in den nächsten Tagen (Alltagsnutzung, Standortwechsel)
- [ ] Eventuell GitHub Release-Tag v1.0.0-rc2 setzen, falls noch Code-Änderungen kommen
- [ ] BUGS.md im Repo vorbereiten zum Sammeln von Tester-Feedback
- [ ] Tester einladen (max. 6-8 Personen)
- [ ] Tester-Onboarding-Mail / Doc vorbereiten

---

## 🟢 Alpha-Test (20.05. – ca. 14.06., während Credit-Cooldown)

**Strategie:** Beobachten, sammeln, NICHT panisch fixen. Bugs in die Liste unten eintragen. Erst nach Credit-Reset systematisch abarbeiten.

### Bugs aus Alpha (laufend füllen)

*(noch leer — wird während Alpha gefüllt)*

### Feature-Wünsche von Testern (laufend füllen)

*(noch leer — wird während Alpha gefüllt)*

### UI/UX-Beobachtungen (laufend füllen)

*(noch leer — wird während Alpha gefüllt)*

---

## 🟡 Phase 8 — Post-Release Polish (ab ca. 14.06., neue 100 Credits)

### Offene Polish-Punkte vor Alpha (aus v1.0)

- Schnee im Nowcast kaum ablesbar
- Schnee-Tabwechsel-Animation überarbeiten
- Nowcast UI komplett überarbeiten — *braucht noch Ideen-Sammlung*

### Plus alle Findings aus dem Alpha-Test

(siehe oben)

---

## 🟢 Phase 9 — Neue Features (ab ca. 14.06.)

### 🎯 Hohe Synergie / Quick Wins

- **GPS-Standort-Bestimmung** — Standardfeature, fehlt eigentlich noch
- **Standortbezogene KI-Tagesinfo** — „Heute wird das Wetter so… also kannst du in… Regenschirm mitnehmen…"
- **Push-Benachrichtigungen** für Warnungen
- **Warn-Indikator** auf „Aktuell" mit direkter Verlinkung zur Warnungen-Seite
- **Detail-Ansicht für Warnungen** + Teilen-Funktion (evtl. als Overlay)

### 🎁 Spezielle Zielgruppen

- **Bergwetter** (Wanderer, Skifahrer)
- **Gezeiten** (Küste, Segler)
- **Pollenflug** (Allergiker)
- **Gewässertemperatur** (Schwimmer, Angler)
- **NINA-Gefahrenmeldungen** (Sicherheitsbewusste)

### 💎 Größere Vorhaben

- Mehrere KI-Warnkarten
- Einsteiger- vs. Nerd-Modus
- KI Wetter-Lexikon (langfristig)

---

## 📊 Credit-Übersicht

| Datum | Verbrauch | Rest |
|---|---|---|
| Start 16.05. | — | 14,8 |
| Bundle A: Warnungs-Filter | ~3 | ~12 |
| Bundle B: Blitzortung + Karten Darkmode | ~3 | **8,8** |
| Reserve für Hotfixes bis 20.05. | — | 8,8 |
| Credit-Reset (ca. 14.06.) | +100 | ~108 |

---

## 📝 Notizen für die Alpha-Phase

**Worauf achten beim Sammeln:**
- Beim Bug: *Datum, Standort, Tab, was passiert, was sollte passieren*
- Beim Feature-Wunsch: *Wer hat's vorgeschlagen, wofür wäre es gut, wie oft käme es vor*
- Beim UI/UX-Punkt: *Welcher Tab, was nervt konkret, Screenshot wenn möglich*

**Was NICHT tun in Alpha:**
- Bei jedem Bug sofort patchen
- Mehr als 6-8 Tester einladen
- Neue Features in Alpha einbauen (verwirrt Tester)
- Defensiv auf Kritik reagieren
