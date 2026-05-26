/**
 * Unwetter-Risiko-Tachos: rendert die Top-4-Risiken aus useWeatherRisks
 * als Halbkreis-Gauges. Versteckt sich automatisch, wenn alle Risiken
 * unterhalb der Sichtbarkeitsschwelle (Score ≤ 10) liegen.
 */
import { useEffect, useState } from "react";
import { useWeatherRisks } from "@/hooks/useWeatherRisks";
import RiskIcon, { type RiskIconId } from "@/components/RiskIcon";
import type { RiskItem } from "@/hooks/useWeatherRisks";

const ARC_RADIUS = 26;
const ARC_CX = 32;
const ARC_CY = 36;
const ARC_LENGTH = Math.PI * ARC_RADIUS; // ≈ 81.68

const NAME_LABEL: Record<RiskIconId, string> = {
  gewitter: "Gewitter",
  starkregen: "Starkregen",
  hagel: "Hagel",
  sturm: "Sturm",
  schneesturm: "Schneesturm",
  glatteis: "Glatteis",
  nebel: "Nebel",
};

function scoreColor(score: number): string {
  if (score <= 10) return "#8e8e93";
  if (score <= 25) return "#34c759";
  if (score <= 60) return "#ff9500";
  if (score <= 85) return "#ff3b30";
  return "#c0392b";
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function Gauge({ risk, index, isDark }: { risk: RiskItem; index: number; isDark: boolean }) {
  const score = Math.max(0, Math.min(100, risk.score));
  const color = scoreColor(score);
  const trackColor = isDark ? "#2c2c2e" : "#e5e5ea";

  // Winkel: -180° (links) bis 0° (rechts), Score skaliert linear
  const rawAngle = -180 + (score / 100) * 180;
  const scoreAngle = Math.min(0, rawAngle);
  const tip = polar(ARC_CX, ARC_CY, 18, scoreAngle);

  // Mount-Animation: vom Anfangszustand zum Zielzustand
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  const dashoffset = mounted ? ARC_LENGTH * (1 - score / 100) : ARC_LENGTH;
  const needleRotation = mounted ? scoreAngle : -180;
  const delay = `${index * 0.1}s`;

  const trackPath = describeArc(ARC_CX, ARC_CY, ARC_RADIUS, -180, 0);
  const fillPath = describeArc(ARC_CX, ARC_CY, ARC_RADIUS, -180, 0);

  const levelLabel = `${risk.isEstimate ? "~" : ""}${risk.label}`;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-1">
        <RiskIcon id={risk.id} size={20} color="hsl(var(--muted-foreground))" />
      </div>

      <svg
        width={64}
        height={38}
        viewBox="0 0 64 38"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Track */}
        <path
          d={trackPath}
          stroke={trackColor}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        {/* Fill */}
        <path
          d={fillPath}
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={dashoffset}
          style={{
            transition: "stroke-dashoffset 1.1s cubic-bezier(0.34, 1.4, 0.64, 1)",
            transitionDelay: delay,
          }}
        />
        {/* Nadel */}
        <line
          x1={ARC_CX}
          y1={ARC_CY}
          x2={tip.x}
          y2={tip.y}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            transform: `rotate(${needleRotation - scoreAngle}deg)`,
            transformOrigin: `${ARC_CX}px ${ARC_CY}px`,
            transition: "transform 1.1s cubic-bezier(0.34, 1.4, 0.64, 1)",
            transitionDelay: delay,
          }}
        />
        {/* Zentrum */}
        <circle cx={ARC_CX} cy={ARC_CY} r={2.5} fill={color} />
      </svg>

      <div
        className="mt-1 text-[14px] font-extrabold leading-none tabular-nums"
        style={{ color }}
      >
        {score}
      </div>
      <div className="mt-0.5 text-[8px] uppercase tracking-wide text-muted-foreground">
        {NAME_LABEL[risk.id]}
      </div>
      <div className="text-[9px] font-bold" style={{ color }}>
        {levelLabel}
      </div>
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
        <div className="grid grid-cols-4 items-start gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[90px] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </CardShell>
    );
  }

  if (risks.length === 0) return null;

  const allLow = risks.every((r) => r.score <= 10);
  if (allLow) return null;

  return (
    <CardShell>
      <div className="grid grid-cols-4 items-start gap-1">
        {risks.map((r, i) => (
          <Gauge key={r.id} risk={r} index={i} isDark={isDark} />
        ))}
      </div>
    </CardShell>
  );
}
