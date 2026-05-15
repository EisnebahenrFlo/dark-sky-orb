import { useEffect, useState } from "react";
import { Sunrise, Sunset, Moon, Sun } from "lucide-react";

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

  // Status text
  let status: string;
  if (beforeSunrise) {
    status = `Sonne geht auf in ${formatDuration(sr.getTime() - now.getTime())}`;
  } else if (afterSunset) {
    const next = nextSunrise ? new Date(nextSunrise) : null;
    status = next
      ? `Nächster Sonnenaufgang um ${formatTime(nextSunrise!)}`
      : "Sonne ist untergegangen";
  } else if (progress < 0.5) {
    status = "Steigt noch";
  } else if (progress < 0.55) {
    status = "Höchststand erreicht";
  } else {
    status = "Sinkt wieder";
  }

  // Geometry: viewBox 200x110, arc from (20,100) to (180,100), radius 80, center (100,100)
  const cx = 100;
  const cy = 100;
  const r = 80;
  const angle = Math.PI * (1 - progress); // π → left (sunrise), 0 → right (sunset)
  const sunX = cx + r * Math.cos(angle);
  const sunY = cy - r * Math.sin(angle);

  // Active arc from sunrise (20,100) to current sun position
  // Use elliptical arc command. sweep-flag = 1 (clockwise on this svg with y-down means upper arc).
  const activePath = `M 20 100 A ${r} ${r} 0 0 1 ${sunX.toFixed(2)} ${sunY.toFixed(2)}`;

  return (
    <div className="glass rounded-2xl p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
        Sonnenstand
      </div>

      <div className="mx-auto w-full max-w-md">
        <svg viewBox="0 0 200 110" className="w-full" aria-hidden>
          <defs>
            <linearGradient id="sunArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground/30"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Active arc */}
          {isDay && progress > 0 && (
            <path
              d={activePath}
              fill="none"
              stroke="url(#sunArcGrad)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}

          {/* Sun marker */}
          {isDay && (
            <>
              <circle
                cx={sunX}
                cy={sunY}
                r={10}
                fill="#fbbf24"
                opacity={0.3}
                className="animate-pulse-glow"
              />
              <circle cx={sunX} cy={sunY} r={6} fill="#fbbf24" />
            </>
          )}

          {/* Moon at the apex when night */}
          {!isDay && (
            <g transform="translate(94 38)">
              <circle cx={6} cy={6} r={11} fill="currentColor" className="text-muted-foreground/15" />
              <Moon
                x={-2}
                y={-2}
                width={16}
                height={16}
                className="text-muted-foreground"
                strokeWidth={1.75}
              />
            </g>
          )}
        </svg>

        {/* Endpoint labels */}
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex flex-col items-start gap-0.5">
            <Sunrise className="h-4 w-4 text-accent" strokeWidth={1.75} />
            <span className="font-mono tabular-nums text-foreground">{formatTime(sunrise)}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Sunset className="h-4 w-4 text-accent" strokeWidth={1.75} />
            <span className="font-mono tabular-nums text-foreground">{formatTime(sunset)}</span>
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
