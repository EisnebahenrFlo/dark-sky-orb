═══════════════════════════════════════════
PROJEKT METEOFLO
═══════════════════════════════════════════

URL: meteoflo.com
Version: v1.0.0-rc1
Release 1.0 geplant: 20.05.2026


═══════════════════════════════════════════
✅ STATUS: v1.0 IST FEATURE-COMPLETE
═══════════════════════════════════════════

Alle geplanten Features für 1.0 sind drin. Die wichtigsten Bugs sind gefixt. Reif für den Release.


🎉 IMPLEMENTIERTE FEATURES

Kernfunktionen:
• Aktuelles Wetter mit Gewitterpotential
• Nowcast (2h & 6h) mit Niederschlagsart (Regen, Starkregen, Schnee, Graupel, Hagel)
• Stündliche Vorhersage mit Gewitterpotential
• 7-Tage Vorhersage mit Gewitterpotential
• Wetterradar (RainViewer) mit Autoplay
• Native Blitzortung
• UV-Index
• Sonnenstand (Aufgang / Untergang / Verlauf)

KI-Features:
• Synoptische KI-Wetteranalyse
• KI-Wetter- und Unwetterwarnung (experimentell)
• KI-Gewitter- und Unwetterauswertung

Warnungen:
• Amtliche Wetterwarnungen DACH (DWD)
• Amtliche Wetterwarnungen Italien (MeteoAlarm) mit DE-Übersetzung
• Warn-Indikator im Tab „Aktuell" mit Verlinkung zur Warnungen-Seite

App & UX:
• ReBrand „MeteoFlo" + eigene Domain meteoflo.com
• Standort-Favoriten
• Splash- und Lade-Screen-Animationen
• Animierter Tab-Wechsel
• Fehler-Splashscreen mit Home-Button
• Dark / Light Mode
• Datenschutz und Impressum


🐛 BUGFIXES & POLISH (MAI 2026)

• Sonnenstand-Design überarbeitet
• Badge zeigte „1" trotz keiner Warnungen → gefixt
• Ladebalken bei KI-Analyse
• Blitzortung Cookie-Fenster behoben
• UI Polish stündliche Vorhersagen
• Regen-Icon trotz 0,0mm Niederschlag → konsistent
• Wetterradar Zoomstufe + Autoplay funktionieren
• Palermo „Page Not Found" → gefixt
• Standort/Infos bei KI-Warnungen → richtiger Standort
• KI-Analyse aktualisiert bei Standortwechsel
• Bundle A: Wetterwarnungs-Summary zeigt amtliche Warnungen korrekt
• Bundle A: Grüne MeteoAlarm-Warnungen (Italien Level 1) werden gefiltert
• Bundle B: Blitzortung zeigt jetzt sichtbare Blitze
• Bundle B: Karte Wetterradar UND Blitzortung im Darkmode lesbar


═══════════════════════════════════════════
🔵 PHASE 7 — PRE-RELEASE ENDSPURT (BIS 20.05.)
═══════════════════════════════════════════

Credit-Budget: 8,8 verbleibend → als Hotfix-Puffer aufheben
Strategie: Keine größeren Änderungen mehr. Selbsttest in Ruhe weiterführen, Bugs sammeln, in Phase 8 fixen.


TO-DO BIS RELEASE

☐ Selbsttest weiterführen (Alltagsnutzung, Standortwechsel)
☐ Bugs in BUGs.md eintragen
☐ Eventuell GitHub Release-Tag v1.0.0-rc2 setzen, falls noch Code-Änderungen kommen
☐ Tester einladen (max. 6-8 Personen)
☐ Tester-Onboarding-Mail / Doc vorbereiten


═══════════════════════════════════════════
🟢 ALPHA-TEST (20.05. – CA. 14.06.)
═══════════════════════════════════════════

Strategie: Beobachten, sammeln, NICHT panisch fixen. Bugs in BUGs.md. Erst nach Credit-Reset systematisch abarbeiten.


BUGS AUS ALPHA (laufend füllen — in BUGs.md)

(noch leer — wird während Alpha gefüllt)


FEATURE-WÜNSCHE VON TESTERN

(noch leer — wird während Alpha gefüllt)


UI/UX-BEOBACHTUNGEN

(noch leer — wird während Alpha gefüllt)


═══════════════════════════════════════════
🟡 PHASE 8 — POST-RELEASE POLISH (AB CA. 14.06.)
═══════════════════════════════════════════


BUGS AUS SELBSTTEST (gefunden 16.05.)

🟠 Wettericons im Nowcast nicht unter den Uhrzeiten — Layout-Bug
🟠 Gewitterpotential (Tab „Aktuell") ≠ Gewitterrisiko (Tab „Warnungen") — Konsistenz, klären ob beabsichtigt oder Bug
🟡 Favoriten: Wetterdaten-Abruf dauert zu lange — Performance / Caching


OFFENE POLISH-PUNKTE AUS v1.0

• Schnee im Nowcast kaum ablesbar
• Schnee-Tabwechsel-Animation überarbeiten
• Nowcast UI komplett überarbeiten — inkl. Legende-Idee (was bedeuten welche Farben?)


PLUS ALLE FINDINGS AUS ALPHA-TEST

(aus BUGs.md übernehmen)


═══════════════════════════════════════════
🟢 PHASE 9 — KI-FEATURE-OFFENSIVE (AB CA. 14.06.)
═══════════════════════════════════════════

Strategie: MeteoFlo soll sich durch KI von 0815-Wetter-Apps abheben. Phase 9 fokussiert deshalb fast komplett auf KI-Features. Standard-Wetter-Features sind solide, aber kein USP.


🥇 KI-CORE (DIFFERENZIERUNGS-FEATURES)

1. „Frag MeteoFlo" — Konversations-Chat
   Nutzer fragt natürlich: „Soll ich die Wäsche raushängen?" / „Brauche ich Sonnencreme?" / „Wie wird's Mittwoch in Hamburg?" — KI antwortet kontextuell mit aktuellen Daten.
   → DER Game-Changer für die App. Wetter-Concierge statt Daten-Dashboard.

2. KI-Aktivitäts-Empfehlung
   „Heute perfekt für: Joggen ab 7 Uhr, Garten ab 14 Uhr, Grillen unsicher (Schauer möglich)." Konkret, handlungsorientiert, direkt umsetzbar.

3. KI-Wettervergleich
   „So warm wie sonst im Juli." / „6 Grad kälter als gestern." / „Erste 25°C des Jahres." Klimadaten + KI = Aha-Momente.

4. KI-Reisewetter
   „Ich fahre Donnerstag 3 Tage nach Rom." → KI fasst Wetter dort zusammen, vergleicht mit Zuhause, gibt Packing-Tipps. Nutzt bestehende Multi-Country-Coverage.

5. Spezialisierte KI-Warnkarten je Risiko-Typ
   Verschiedene KI-Karten mit fachspezifischer Auswertung pro Risiko:
   • Gewitter-Karte: CAPE, LI, Helizität, Konvergenz, Zugbahn-Prognose
   • Glatteis-Karte: Bodentemperatur, Taupunkt, Niederschlagsart, Stundenverlauf
   • Hitze-Karte: Heat-Indizes, Hitzeperioden-Dauer, gefährdete Gruppen, Tipps
   • Sturm-Karte: Windspitzen, Böen, Druckverlauf, Trog/Tief-Bewegung
   • Starkregen-Karte: Niederschlagsraten, Stauwetterlage, Hochwassergefahr
   → Aktiviert dynamisch je nach aktueller Risiko-Lage.


🥈 WETTER-FEATURES OHNE KI (solide, aber kein USP)

• GPS-Standort-Bestimmung — Pflichtfeature, fehlt eigentlich noch
• Push-Benachrichtigungen für amtliche Warnungen
• Detail-Ansicht für Warnungen + Teilen-Funktion (evtl. als Overlay)


🗄️ BACKLOG (kann immer noch warten)

• KI-Wetter-Lexikon — Tap auf Begriffe wie „CAPE", „Trog", „Vb-Lage" → KI erklärt's in 2 Sätzen
• Bergwetter (nur wenn Tester explizit nachfragen)
• Pollenflug
• Gewässertemperatur
• Gezeiten
• NINA-Gefahrenmeldungen
• Einsteiger- vs Nerd-Modus


═══════════════════════════════════════════
📊 CREDIT-ÜBERSICHT
═══════════════════════════════════════════

Datum                                          Verbrauch    Rest
─────────────────────────────────────────────  ──────────  ──────
Start 16.05.                                       —        14,8
Bundle A: Warnungs-Filter                          ~3       ~12
Bundle B: Blitzortung + Karten Darkmode            ~3       8,8
Reserve für Hotfixes bis 20.05.                    —        8,8
Credit-Reset (ca. 14.06.)                         +100      ~108


═══════════════════════════════════════════
📝 NOTIZEN FÜR DIE ALPHA-PHASE
═══════════════════════════════════════════


WORAUF ACHTEN BEIM SAMMELN (BUGs.md füttern):

• Beim Bug: Datum, Standort, Tab, was passiert, was sollte passieren, Screenshot wenn möglich
• Beim Feature-Wunsch: Wer hat's vorgeschlagen, wofür wäre es gut
• Beim UI/UX-Punkt: Welcher Tab, was nervt konkret


WAS NICHT TUN IN ALPHA:

• Bei jedem Bug sofort patchen (sammeln, dann in Phase 8 abarbeiten)
• Mehr als 6-8 Tester einladen (Feedback wird unübersichtlich)
• Neue Features in Alpha einbauen (verwirrt Tester, kostet Credits)
• Defensiv auf Kritik reagieren („das ist Absicht weil…")


WAS JA TUN:

• Tester aktiv nachfragen („Hast du heute MeteoFlo benutzt?")
• Erkenne Muster im Feedback (3 Tester sagen dasselbe → ernst nehmen)
• Selbst die App im Alltag nutzen — beste Bug-Quelle
