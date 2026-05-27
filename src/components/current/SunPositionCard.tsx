import { useEffect, useState } from "react";
import { Sunrise, Sunset, Sun, Moon } from "lucide-react";

interface Props {
  sunrise: string;
  sunset: string;
  /** Optional next day's sunrise (used after sunset to display "next sunrise"). */
  nextSunrise?: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} Std ${m} Min`;
}

function interpolateColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16),
    g1 = parseInt(c1.slice(3, 5), 16),
    b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16),
    g2 = parseInt(c2.slice(3, 5), 16),
    b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getSunColor(p: number): string {
  if (p < 0 || p > 100) return "#94a3b8";
  const dist = Math.abs(p - 50) / 50;
  if (p < 50) return interpolateColor("#f97316", "#fbbf24", 1 - dist);
  return interpolateColor("#fbbf24", "#ef4444", dist);
}

/* -------------------- Mondphase -------------------- */

const SYNODIC_MONTH = 29.530588853;
// Bekannter Neumond: 2000-01-06 18:14 UTC
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 1000;

interface MoonInfo {
  /** 0 = Neumond, 0.25 = zunehmend Halb, 0.5 = Vollmond, 0.75 = abnehmend Halb */
  phase: number;
  ageDays: number;
  illumination: number; // 0..1
  waxing: boolean;
  name: string;
}

function computeMoon(date: Date): MoonInfo {
  const nowSec = date.getTime() / 1000;
  const daysSince = (nowSec - KNOWN_NEW_MOON) / 86400;
  const age = ((daysSince % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const phase = age / SYNODIC_MONTH;
  // Beleuchtung: (1 - cos(2π·phase)) / 2
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waxing = phase < 0.5;

  let name: string;
  if (age < 1.0) name = "Neumond";
  else if (age < 6.5) name = "Zunehmende Sichel";
  else if (age < 8.5) name = "Erstes Viertel";
  else if (age < 13.8) name = "Zunehmender Mond";
  else if (age < 15.8) name = "Vollmond";
  else if (age < 21.0) name = "Abnehmender Mond";
  else if (age < 23.0) name = "Letztes Viertel";
  else if (age < 28.5) name = "Abnehmende Sichel";
  else name = "Neumond";

  return { phase, ageDays: age, illumination, waxing, name };
}

/**
 * Rendert eine Mondscheibe mit realistischer Phasen-Schattierung.
 * Die beleuchtete Fläche bleibt hell, die Schattenseite wird durch eine
 * halbkreis- und ellipsenförmige Maske abgedeckt.
 */
function MoonDisk({
  cx,
  cy,
  r,
  moon,
  isDark,
}: {
  cx: number;
  cy: number;
  r: number;
  moon: MoonInfo;
  isDark: boolean;
}) {
  const lit = isDark ? "#f1f5f9" : "#fef3c7";
  const litStroke = isDark ? "#cbd5e1" : "#fcd34d";
  const shadow = isDark ? "#1e293b" : "#475569";
  const shadowOpacity = isDark ? 0.92 : 0.78;

  // Phase 0..1; berechne Ellipsenbreite und Position
  const phase = moon.phase;
  // Wir spiegeln je nach zu-/abnehmend
  // Beleuchteter Bruchteil: cos(π·(phase-0.5)) zwischen -1..1 (für Ellipsen-Radius rx)
  const cos = Math.cos(2 * Math.PI * phase);
  const rx = Math.abs(cos) * r;

  // Wenn Vollmond → keine Schattenscheibe; Neumond → komplett Schatten
  const isNew = moon.illumination < 0.02;
  const isFull = moon.illumination > 0.98;

  // Welche Hälfte ist Schatten?
  // Zunehmend (waxing): Schatten links. Abnehmend: Schatten rechts.
  // Erste Hälfte des Zyklus (waxing < 0.5): beleuchtete Hälfte rechts
  // - phase < 0.25 (zunehmend Sichel): von Schatten geht Ellipse links rein → Schatten = großer Halbkreis links + Ellipse, die rechts in den hellen Bereich frisst? Nein:
  // Standard-Konstruktion:
  //   Halbkreis-Schatten auf einer Seite (volle Hälfte)
  //   Plus oder Minus Ellipse je nach Phase
  // Einfacher: zwei Wege kombinieren via SVG path mit verschiedenen Sweep-Flags.

  // Schattenform als zusammengesetzter Pfad:
  // Wir starten am Top (cx, cy-r), ziehen einen Halbkreis runter zum Bottom (cx, cy+r)
  // auf der Schattenseite (links bei waxing, rechts bei waning),
  // dann zurück über eine Ellipse mit rx, die je nach Phase nach innen/außen wölbt.
  const shadowSideLeft = moon.waxing; // waxing → Schatten links

  // Großbogen-Richtung
  const sweepOuter = shadowSideLeft ? 0 : 1; // halbkreis auf richtiger Seite
  // Innen-Ellipse: bei phase < 0.25 oder phase > 0.75 → Schatten frisst noch in helle Seite (konvex zur hellen Seite)
  // bei 0.25 < phase < 0.75 → helle Seite größer; ellipse wölbt sich zur Schattenseite (konkav)
  const concave = phase > 0.25 && phase < 0.75;
  const sweepInner = shadowSideLeft
    ? concave
      ? 0
      : 1
    : concave
      ? 1
      : 0;

  const topX = cx;
  const topY = cy - r;
  const botX = cx;
  const botY = cy + r;

  const shadowPath = `M ${topX} ${topY} A ${r} ${r} 0 0 ${sweepOuter} ${botX} ${botY} A ${rx} ${r} 0 0 ${sweepInner} ${topX} ${topY} Z`;

  return (
    <g>
      {/* Beleuchtete Scheibe */}
      <circle cx={cx} cy={cy} r={r} fill={lit} stroke={litStroke} strokeWidth={1} />
      {/* Schatten */}
      {!isFull && !isNew && (
        <path d={shadowPath} fill={shadow} opacity={shadowOpacity} />
      )}
      {isNew && (
        <circle cx={cx} cy={cy} r={r} fill={shadow} opacity={shadowOpacity} />
      )}
    </g>
  );
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export function SunPositionCard({ sunrise, sunset, nextSunrise }: Props) {
  const [now, setNow] = useState(() => new Date());
  const isDark = useIsDark();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sr = new Date(sunrise);
  const ss = new Date(sunset);
  const total = ss.getTime() - sr.getTime();
  const elapsed = now.getTime() - sr.getTime();

  const isDay = now >= sr && now <= ss;
  const beforeSunrise = now < sr;
  const afterSunset = now > ss;
  const isNight = !isDay;

  const dayProgress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
  const dayLength = formatDuration(total);

  // Nachtfortschritt: zwischen Sonnenuntergang (heute) und nächstem Aufgang
  const nextSr = nextSunrise ? new Date(nextSunrise) : null;
  let nightProgress = 0;
  let nightLengthMs = 0;
  if (isNight && nextSr) {
    const start = afterSunset ? ss : new Date(sr.getTime() - 12 * 3600 * 1000);
    const end = afterSunset ? nextSr : sr;
    nightLengthMs = end.getTime() - start.getTime();
    nightProgress =
      nightLengthMs > 0
        ? Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / nightLengthMs))
        : 0;
  }

  const progress = isDay ? dayProgress : nightProgress;

  let status: string;
  if (beforeSunrise) {
    status = `Sonne geht auf in ${formatDuration(sr.getTime() - now.getTime())}`;
  } else if (afterSunset) {
    status = nextSunrise
      ? `Nächster Sonnenaufgang um ${formatTime(nextSunrise)}`
      : "Sonne ist untergegangen";
  } else if (dayProgress < 0.5) {
    status = "Steigt noch";
  } else if (dayProgress < 0.55) {
    status = "Höchststand erreicht";
  } else {
    status = "Sinkt wieder";
  }

  const cx = 100;
  const r = 80;
  const angle = Math.PI * (1 - progress);
  const bodyX = cx + r * Math.cos(angle);
  const bodyY = 100 - r * Math.sin(angle);

  const activePath = `M 20 100 A ${r} ${r} 0 0 1 ${bodyX.toFixed(2)} ${bodyY.toFixed(2)}`;
  const sunColor = getSunColor(dayProgress * 100);

  const moon = computeMoon(now);
  const illumPct = Math.round(moon.illumination * 100);

  // Tag-/Nacht-Farbschema (CSS-Tokens für klare Themenanpassung)
  const trackClass = isDay
    ? "text-muted-foreground/25"
    : isDark
      ? "text-slate-200/15"
      : "text-indigo-300/40";

  const arcGradId = isDay ? "sunArcGrad" : "moonArcGrad";

  return (
    <div className="glass mb-12 rounded-2xl p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {isDay ? (
          <>
            <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
            Sonnenstand
          </>
        ) : (
          <>
            <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
            Mondstand
          </>
        )}
      </div>

      <div className="mx-auto w-full max-w-md">
        <svg viewBox="0 0 200 115" className="w-full" aria-hidden>
          <defs>
            <linearGradient id="sunArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.85} />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity={0.9} />
              <stop offset="100%" stopColor={sunColor} stopOpacity={0.85} />
            </linearGradient>
            <linearGradient id="moonArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isDark ? "#818cf8" : "#6366f1"} stopOpacity={0.85} />
              <stop offset="50%" stopColor={isDark ? "#a5b4fc" : "#818cf8"} stopOpacity={0.95} />
              <stop offset="100%" stopColor={isDark ? "#c7d2fe" : "#a5b4fc"} stopOpacity={0.85} />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            className={trackClass}
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* Active arc */}
          {progress > 0 && (
            <path
              d={activePath}
              fill="none"
              stroke={`url(#${arcGradId})`}
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}

          {/* Sonne oder Mond als Marker */}
          {isDay ? (
            <circle
              cx={bodyX}
              cy={bodyY}
              r={10}
              fill={sunColor}
              stroke={isDark ? "#0f172a" : "#ffffff"}
              strokeWidth={1.5}
            />
          ) : (
            <g>
              {/* Heller Halo für Sichtbarkeit */}
              <circle
                cx={bodyX}
                cy={bodyY}
                r={12}
                fill={isDark ? "#a5b4fc" : "#6366f1"}
                opacity={0.18}
              />
              <MoonDisk cx={bodyX} cy={bodyY} r={10} moon={moon} isDark={isDark} />
            </g>
          )}
        </svg>

        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex flex-col items-start gap-1">
            <Sunrise className="h-5 w-5 text-accent" strokeWidth={1.75} />
            <span className="font-mono text-sm tabular-nums text-foreground">
              {formatTime(sunrise)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Sunset className="h-5 w-5 text-accent" strokeWidth={1.75} />
            <span className="font-mono text-sm tabular-nums text-foreground">
              {formatTime(sunset)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="font-display text-lg">
          Tageslänge <span className="tabular-nums">{dayLength}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{status}</div>
      </div>

      {/* Mond-Info-Streifen — immer sichtbar, nachts hervorgehoben */}
      <div
        className={`mt-5 flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
          isNight
            ? isDark
              ? "border-indigo-400/30 bg-indigo-500/10"
              : "border-indigo-300/60 bg-indigo-50"
            : "border-border bg-muted/40"
        }`}
      >
        <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden className="shrink-0">
          <MoonDisk cx={18} cy={18} r={15} moon={moon} isDark={isDark} />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{moon.name}</div>
          <div className="text-xs text-muted-foreground">
            {illumPct}% beleuchtet · Mondalter {moon.ageDays.toFixed(1)} Tage
          </div>
        </div>
      </div>
    </div>
  );
}
