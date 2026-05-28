## Ziel

Die Blitzanzeige zeigt aktuell zu wenige Blitze. Wir kombinieren drei Quellen, damit für **DACH + Italien** zuverlässig alle relevanten Entladungen erscheinen – auch wenn eine Quelle schwächelt.

## Architekturüberblick

```text
                ┌──────────────────────────────┐
Browser  ◄────► │  /api/lightning-stream (SSE) │ ◄── Blitzortung WS (server-side)
                └──────────────────────────────┘         (3 Endpunkte, Failover, Region-Filter)
                ┌──────────────────────────────┐
Browser  ◄────► │  /api/lightning-backfill     │ ◄── In-Memory Ringbuffer (60 min, server)
                └──────────────────────────────┘
                ┌──────────────────────────────┐
Browser  ◄────► │  /api/rainbow-lightning-tile │ ◄── Rainviewer Lightning-Tiles
                └──────────────────────────────┘
                ┌──────────────────────────────┐
Browser  ◄────► │  /api/lightning-potential    │ ◄── Open-Meteo (lightning_potential, CAPE)
                └──────────────────────────────┘
```

Der Browser kombiniert die Layer:
- **Einzelblitze** (Punkte) aus Blitzortung-SSE + Backfill
- **Globale Aktivität** (Tile-Layer) aus Rainviewer als Plausibilitäts-/Lücken-Füller
- **Wahrscheinlichkeits-Heatmap** (Open-Meteo) zeigt, wo *demnächst* Blitze zu erwarten sind

## Warum das mehr Blitze liefert

1. **Server-Proxy stabilisiert WS**: Aktuell verbindet jeder Client direkt zu Blitzortung. Server-Proxy hält 2–3 Endpunkte parallel, deduped Strikes per ID, hält 60 min Backfill → User sieht beim App-Öffnen sofort die letzten 60 min, nicht nur was *ab jetzt* reinkommt.
2. **Mehrere WS-Endpoints gleichzeitig** (ws1/ws7/ws8): unterschiedliche Endpoints liefern teils unterschiedliche Strikes; Merge erhöht Trefferquote spürbar.
3. **Rainviewer-Tiles als Fallback-Visualisierung**: zeigt Blitzaktivität auch wenn Blitzortung-Detektoren in einer Region gerade Lücken haben (typisch Italien Süd, Alpen).
4. **Open-Meteo lightning_potential** zeigt vorhersagliche Gewitter-Hotspots – nicht nur was *war*, sondern was *kommt*.

## Umsetzung – Schritte

### 1. Server-Proxy für Blitzortung
**Datei:** `api/lightning-stream.ts` (Vercel-Edge oder Node, je nach aktueller `api/`-Struktur)

- Hält 2 WS-Verbindungen offen (ws1 + ws7) zu blitzortung.org
- Filtert serverseitig auf BBox **DACH + Italien** (lat 35–56, lon 5–18) → drastisch weniger Traffic zum Client
- Pusht Strikes via **Server-Sent Events** an verbundene Clients (einfacher & robuster als WS durch Proxies)
- Hält Ringbuffer der letzten 60 min (max ~5000 Strikes, ~150 KB)
- Dedup per `(time, lat, lon)`-Hash

**Datei:** `api/lightning-backfill.ts`
- Liefert den Ringbuffer als JSON auf Anfrage (`GET /api/lightning-backfill?since=…`)

### 2. Client-Hook neu
**Datei:** `src/hooks/useLightningStream.ts` (ersetzt `useBlitzortungWS`)

- Beim Mount: erst Backfill holen → instant volle Karte
- Dann SSE abonnieren → Live-Updates
- Auto-Reconnect mit Exponential Backoff
- API-kompatibel zum bisherigen Hook (`strikes`, `isConnected`, `strikesLast10Min`, `reconnect`)

### 3. Rainviewer Lightning-Layer
**Datei:** `api/rainbow-lightning-tile.ts` (analog zu `rainbow-tile.ts`)

- Holt Rainviewer `weather-maps.json` → extrahiert Lightning-Frames
- Proxy für Tiles `{z}/{x}/{y}`

**Komponente:** `LightningMap.tsx` erweitert
- Toggle „Globale Aktivität" → blendet Rainviewer-TileLayer ein (Opacity 0.6)

### 4. Open-Meteo Wahrscheinlichkeits-Overlay
**Datei:** `src/hooks/useLightningPotential.ts`
- Holt `lightning_potential` + `cape` + `lifted_index` über Open-Meteo für die aktuelle Karten-BBox (Grid 0.25°)
- Cached 15 min

**Komponente:** Heatmap-Overlay (leaflet.heat) auf der Karte, Toggle „Vorhersage 6 h"

### 5. UI-Verbesserungen Karte
- **Layer-Switcher** oben rechts: ☑ Live-Blitze ☑ Globale Aktivität ☐ Vorhersage
- **Statistik-Bar**: „142 Blitze · letzte 10 min · ⚡ Hotspot 47 km SW"
- **Hotspot-Detection**: DBSCAN-Clustering der Strikes → Cluster-Marker mit Stärke + Distanz zum User
- **Distanz-Label** an einzelnen Blitzen (>1 Blitz/min): „12 km · 3 s"
- **Audio-Ping** (optional, toggle) bei Blitz im Umkreis 30 km

### 6. Cleanup
- `useBlitzortungWS.ts` und `blitzortungDecoder.ts` ziehen in Server-Function um (`api/_lib/blitzortungDecoder.ts`) – Client braucht keinen LZW-Decoder mehr
- Alter Hook wird Deprecation-Wrapper auf neuen, bis alle Consumer migriert sind

## Technische Details

- **SSE statt WS Client→Server**: durchquert Cloudflare/Vercel-Proxies zuverlässiger, kein Sticky-Session-Problem
- **Region-Filter serverseitig**: spart ~80 % Bandbreite (weltweit ~5 Strikes/s → DACH+IT ~1 Strike/s)
- **In-Memory Ringbuffer**: ok für eine Worker-Instanz; bei mehreren Instanzen reicht das („eventually consistent", User sieht je nach Instanz minimal andere Backfills – akzeptabel)
- **Rainviewer Lightning**: kostenlos, ~5-min-Frames, weltweit, gut als visueller Reality-Check
- **Open-Meteo lightning_potential**: ICON-D2, perfekt für DACH; für Italien fällt es auf ICON-EU zurück (etwas gröber, aber verfügbar)

## Out of scope (jetzt nicht)

- CG/IC-Klassifikation (Blitzortung liefert das nicht zuverlässig)
- Polarität/Stromstärke (nur in kommerziellen Netzen)
- Push-Benachrichtigungen bei Blitz im Umkreis (machen wir später im Storm-Tracking-Schritt)
- Storm-Cell-Tracking auf Basis der Cluster (kommt im nächsten Plan)

## Reihenfolge der Implementierung

1. Server-Proxy + Backfill (`api/lightning-stream.ts`, `api/lightning-backfill.ts`)
2. Neuer Client-Hook `useLightningStream`
3. `LightningMap.tsx` auf neuen Hook umstellen + Layer-Switcher
4. Rainviewer-Lightning-Tile-Proxy + Toggle
5. Open-Meteo-Potential-Hook + Heatmap-Overlay
6. Hotspot-Cluster + Statistik-Bar
7. Alten Hook entfernen

Nach Schritt 1–3 ist die Hauptbeschwerde („zu wenige Blitze") bereits gelöst. Schritte 4–6 sind Bonus-Polish.
