/**
 * Unwetter-Risiko: Donut-Ring-Variante (A).
 * Aktive Risiken (Score > 10) als gefüllter Ring mit Icon in der Mitte,
 * Score darunter und farbigem Level-Chip. Inaktive werden als kompakte
 * Mini-Chip-Zeile zusammengefasst, damit aktive Risiken visuell dominieren.
 */
import { useEffect, useState } from "react";
import { useWeatherRisks } from "@/hooks/useWeatherRisks";
import RiskIcon, { type RiskIconId } from "@/components/RiskIcon";
import type { RiskItem } from "@/hooks/useWeatherRisks";

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const NAME_LABEL: Record<RiskIconId, string> = {
  gewitter: "Gewitter",
  starkregen: "Starkregen",
  hagel: "Hagel",
  sturm: "Sturm",
  schneesturm: "Schneesturm",
  glatteis: "Glatteis",
  nebel: "Nebel",
  frost: "Frost",
  hitze: "Hitze",
  uv: "UV",
};

/**
 * Farbpalette pro Schwellenwert.
 * Jeweils eine Light- und Dark-optimierte Variante, damit die Ringe und
 * Chips in beiden Modi gut sichtbar bleiben (WCAG-tauglicher Kontrast).
 */
function scoreColors(score: number, isDark: boolean): {
  ring: string;
  chipBg: string;
  chipText: string;
  scoreText: string;
} {
  if (score <= 10) {
    return isDark
      ? { ring: "#3a3a3c", chipBg: "rgba(142,142,147,0.18)", chipText: "#9ea0a6", scoreText: "#9ea0a6" }
      : { ring: "#d1d1d6", chipBg: "rgba(99,99,102,0.12)", chipText: "#6b6b70", scoreText: "#6b6b70" };
  }
  if (score <= 25) {
    return isDark
      ? { ring: "#30d158", chipBg: "rgba(48,209,88,0.22)", chipText: "#4ade80", scoreText: "#4ade80" }
      : { ring: "#22c55e", chipBg: "rgba(34,197,94,0.14)", chipText: "#15803d", scoreText: "#15803d" };
  }
  if (score <= 60) {
    return isDark
      ? { ring: "#ff9f0a", chipBg: "rgba(255,159,10,0.22)", chipText: "#fbbf24", scoreText: "#fbbf24" }
      : { ring: "#f59e0b", chipBg: "rgba(245,158,11,0.16)", chipText: "#b45309", scoreText: "#b45309" };
  }
  if (score <= 85) {
    return isDark
      ? { ring: "#ff453a", chipBg: "rgba(255,69,58,0.22)", chipText: "#fca5a5", scoreText: "#fca5a5" }
      : { ring: "#ef4444", chipBg: "rgba(239,68,68,0.14)", chipText: "#b91c1c", scoreText: "#b91c1c" };
  }
  return isDark
    ? { ring: "#ff375f", chipBg: "rgba(255,55,95,0.28)", chipText: "#fda4af", scoreText: "#fda4af" }
    : { ring: "#dc2626", chipBg: "rgba(220,38,38,0.16)", chipText: "#991b1b", scoreText: "#991b1b" };
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

function RiskRing({ risk, index, isDark }: { risk: RiskItem; index: number; isDark: boolean }) {
  const score = Math.max(0, Math.min(100, risk.score));
  const colors = scoreColors(score, isDark);
  const trackColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const dashoffset = mounted
    ? RING_CIRCUMFERENCE * (1 - score / 100)
    : RING_CIRCUMFERENCE;
  const delay = `${index * 0.08}s`;
  const levelLabel = `${risk.isEstimate ? "~" : ""}${risk.label}`;

  return (
    <div className="flex flex-col items-center" title={`${NAME_LABEL[risk.id as RiskIconId]}: ${risk.label} · Score ${score} · ${risk.dwdLabel}`}>
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ transform: "rotate(-90deg)" }}
        >
          {/* Track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={trackColor}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          {/* Fill */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.ring}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashoffset}
            style={{
              transition: "stroke-dashoffset 1.1s cubic-bezier(0.34, 1.4, 0.64, 1)",
              transitionDelay: delay,
            }}
          />
        </svg>
        {/* Icon zentriert */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: colors.ring }}
        >
          <RiskIcon id={risk.id} size={26} color="currentColor" />
        </div>
      </div>

      <div
        className="mt-1.5 text-[15px] font-bold leading-none tabular-nums"
        style={{ color: colors.scoreText }}
      >
        {score}
      </div>

      <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-foreground/70">
        {NAME_LABEL[risk.id]}
      </div>

      <div
        className="mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none"
        style={{ backgroundColor: colors.chipBg, color: colors.chipText }}
      >
        {levelLabel}
      </div>
    </div>
  );
}

function InactiveRow({ risks }: { risks: RiskItem[] }) {
  if (risks.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 border-t border-border/50 pt-3">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        Kein Risiko:
      </span>
      {risks.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          <RiskIcon id={r.id} size={11} color="currentColor" />
          {NAME_LABEL[r.id]}
        </span>
      ))}
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass animate-in fade-in slide-in-from-top-2 rounded-2xl p-4 duration-500">
      <div className="mb-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        Unwetter-Risiko
      </div>
      {children}
    </div>
  );
}

export default function WeatherRiskGauges() {
  const { risks, isLoading, error } = useWeatherRisks();
  const isDark = useIsDark();

  if (error) {
    return (
      <CardShell>
        <p className="py-4 text-center text-xs text-muted-foreground">
          Risikodaten nicht verfügbar
        </p>
      </CardShell>
    );
  }

  if (isLoading && risks.length === 0) {
    return (
      <CardShell>
        <div className="grid grid-cols-4 items-start gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[110px] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </CardShell>
    );
  }

  if (risks.length === 0) return null;

  const active = risks.filter((r) => r.score > 10);
  const inactive = risks.filter((r) => r.score <= 10);

  if (active.length === 0) return null;

  return (
    <CardShell>
      <div
        className="grid items-start gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(active.length, 4)}, minmax(0, 1fr))` }}
      >
        {active.map((r, i) => (
          <RiskRing key={r.id} risk={r} index={i} isDark={isDark} />
        ))}
      </div>
      <InactiveRow risks={inactive} />
    </CardShell>
  );
}
