import { useEffect, useState } from "react";
import { Sunrise, Sunset, Sun } from "lucide-react";

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

export function SunPositionCard({ sunrise, sunset, nextSunrise }: Props) {
  const [now, setNow] = useState(() => new Date());

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

  const progress = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
  const dayLength = formatDuration(total);

  let status: string;
  if (beforeSunrise) {
    status = `Sonne geht auf in ${formatDuration(sr.getTime() - now.getTime())}`;
  } else if (afterSunset) {
    status = nextSunrise
      ? `Nächster Sonnenaufgang um ${formatTime(nextSunrise)}`
      : "Sonne ist untergegangen";
  } else if (progress < 0.5) {
    status = "Steigt noch";
  } else if (progress < 0.55) {
    status = "Höchststand erreicht";
  } else {
    status = "Sinkt wieder";
  }

  const cx = 100;
  const r = 80;
  const angle = Math.PI * (1 - progress);
  const sunX = cx + r * Math.cos(angle);
  const sunY = 100 - r * Math.sin(angle);

  const activePath = `M 20 100 A ${r} ${r} 0 0 1 ${sunX.toFixed(2)} ${sunY.toFixed(2)}`;
  const sunColor = getSunColor(progress * 100);

  // Mid-arc position for the night moon marker (top of arc).
  const moonX = cx;
  const moonY = 100 - r;

  return (
    <div className="glass mb-12 rounded-2xl p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
        Sonnenstand
      </div>

      <div className="mx-auto w-full max-w-md">
        <svg viewBox="0 0 200 115" className="w-full" aria-hidden>
          <defs>
            <linearGradient id="sunArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity={0.85} />
              <stop offset="100%" stopColor={sunColor} stopOpacity={0.8} />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground/25"
            strokeWidth={4}
            strokeLinecap="round"
          />

          {/* Active arc (covered portion) */}
          {isDay && progress > 0 && (
            <path
              d={activePath}
              fill="none"
              stroke="url(#sunArcGrad)"
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}

          {/* Sun marker — simple circle with subtle white border */}
          {isDay && (
            <circle
              cx={sunX}
              cy={sunY}
              r={10}
              fill={sunColor}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          )}

          {/* Moon marker — static, neutral grey */}
          {!isDay && (
            <circle
              cx={moonX}
              cy={moonY}
              r={10}
              fill="#94a3b8"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          )}
        </svg>

        <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex flex-col items-start gap-1">
            <Sunrise className="h-5 w-5 text-accent" strokeWidth={1.75} />
            <span className="font-mono text-sm tabular-nums text-foreground">{formatTime(sunrise)}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Sunset className="h-5 w-5 text-accent" strokeWidth={1.75} />
            <span className="font-mono text-sm tabular-nums text-foreground">{formatTime(sunset)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="font-display text-lg">
          Tageslänge <span className="tabular-nums">{dayLength}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{status}</div>
      </div>
    </div>
  );
}
