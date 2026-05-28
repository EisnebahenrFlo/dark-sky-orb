# Fix: Vorhersage-Tab zeigt keinen Inhalt

## Diagnose

Im Preview-Browser wechselt der Klick auf "Vorhersage" die URL korrekt auf `/vorhersage` und rendert die Seite (Segmented Control + Status). Auf dem iPhone berichtet der User: URL wechselt, aber **Inhalt fehlt**.

Wahrscheinlichste Ursache: `WeatherTabTransition` umschließt den `<Outlet />` mit `<div key={pathname} className="animate-tab-fade">`. Die zugehörige Keyframe startet bei `opacity: 0; translateY(6px)` und nutzt `animation-fill-mode: both`. Wenn die Animation auf iOS Safari nicht startet (Tab-Wechsel, Paint-Skip, Fokus-Restore, Reduced Motion + Cache-Edge-Case), bleibt der Inhalt auf `opacity: 0` hängen — die Seite ist da, aber unsichtbar.

## Fix (klein, fokussiert)

### 1. `WeatherTabTransition` robust machen

`src/components/transitions/WeatherTabTransition.tsx`:
- `key={pathname}` entfernen — der Outlet rendert die richtige Route auch ohne Force-Remount, und der Remount ist genau das, was die fragile Animation triggert.
- Den umschließenden `<div className="animate-tab-fade">` durch einen neutralen Wrapper ersetzen, der **immer sichtbar** ist (`opacity: 1`), und die Animation per CSS-Klasse `tab-fade-enter` nur als reine Einblend-Animation ohne `both`-Fill auf das Kind anwenden. Fallback: Wenn die Animation nicht läuft, ist Opacity trotzdem 1.

Konkret: Komponente vereinfachen zu

```tsx
export function WeatherTabTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="tab-fade-in">
      {children}
    </div>
  );
}
```

### 2. `src/styles.css` – Animation safe machen

- Keyframe `tab-fade` umbenennen/anpassen, sodass `from` und `to` beide eine **sichtbare** Opacity haben (z.B. `from: opacity .85, translateY(4px)` → `to: opacity 1, translateY(0)`). Damit ist der Worst-Case (Animation läuft nicht) trotzdem ein vollständig sichtbarer Inhalt.
- Neue Utility-Klasse `.tab-fade-in { animation: tab-fade 220ms cubic-bezier(0.22, 0.61, 0.36, 1); }` — **ohne** `both` Fill-Mode. Default-Opacity bleibt 1.
- `prefers-reduced-motion`-Block aktualisieren: nur `animation: none` — Inhalt bleibt sichtbar.
- Alte `--animate-tab-fade` Token und `.animate-tab-fade`-Referenz entfernen (wurde nur dort genutzt).

### 3. Verifikation

- Im Preview-Browser auf `/`, `/vorhersage`, `/analyse`, `/map` navigieren und sicherstellen, dass jeder Tab-Inhalt sofort sichtbar ist.
- Screenshot von `/vorhersage` nach dem Fix.

## Out of Scope

- Wetter-API-Fehler ("Konnte Daten nicht laden") — das ist ein separates Daten-/Network-Problem (betrifft alle Tabs), nicht der Tab-Bug.
- Andere Animationen oder Layout-Änderungen.
