import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useWeather } from "@/contexts/WeatherContext";

type AnimType = "rain" | "snow" | "thunder" | "day" | "night";

function getAnimType(
  code: number | undefined,
  precip: number | undefined,
  isDay: number | undefined,
): AnimType {
  const c = code ?? 0;
  if (c >= 95 && c <= 99) return "thunder";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if ((precip ?? 0) > 0.3 || (c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  return isDay ? "day" : "night";
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CONTENT_ANIM: Record<AnimType, string> = {
  day: "animate-content-slide-left",
  night: "animate-content-rise",
  rain: "animate-content-fade",
  snow: "animate-content-drop",
  thunder: "animate-content-hard",
};

export function WeatherTabTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data } = useWeather();
  const type = getAnimType(
    data?.current?.weather_code,
    data?.current?.precipitation,
    data?.current?.is_day,
  );

  const [animKey, setAnimKey] = useState(pathname);
  const [overlayKey, setOverlayKey] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    setAnimKey(pathname);
    if (prefersReducedMotion()) return;
    setOverlayKey((k) => k + 1);
    setShowOverlay(true);
    const t = setTimeout(() => setShowOverlay(false), 1300);
    return () => clearTimeout(t);
  }, [pathname]);

  const contentClass = prefersReducedMotion() ? "" : CONTENT_ANIM[type];

  return (
    <div className="relative overflow-hidden min-h-[60vh]">
      {showOverlay && <WeatherAnimationOverlay key={overlayKey} type={type} />}
      <div key={animKey} className={contentClass}>
        {children}
      </div>
    </div>
  );
}

function WeatherAnimationOverlay({ type }: { type: AnimType }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden
    >
      {type === "rain" && <RainOverlay />}
      {type === "snow" && <SnowOverlay />}
      {type === "thunder" && <ThunderOverlay />}
      {type === "day" && <CloudOverlay />}
      {type === "night" && <StarsOverlay />}
    </div>
  );
}

/* ---------------- Clouds (day) ---------------- */
function CloudSVG({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 250 120"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="fill-white dark:fill-slate-300">
        <ellipse cx="70" cy="80" rx="55" ry="32" />
        <ellipse cx="125" cy="65" rx="60" ry="40" />
        <ellipse cx="180" cy="80" rx="50" ry="30" />
        <ellipse cx="100" cy="90" rx="70" ry="22" />
      </g>
    </svg>
  );
}

function CloudOverlay() {
  return (
    <>
      <CloudSVG
        className="absolute top-[8%] h-[120px] w-[250px] opacity-75 will-change-transform animate-cloud-sweep-1"
        style={{ left: 0 }}
      />
      <CloudSVG
        className="absolute top-[28%] h-[90px] w-[190px] opacity-65 will-change-transform animate-cloud-sweep-2"
        style={{ left: 0 }}
      />
    </>
  );
}

/* ---------------- Stars (night) ---------------- */
function StarsOverlay() {
  const stars = Array.from({ length: 18 }).map((_, i) => ({
    top: `${(i * 23) % 85 + 5}%`,
    left: `${(i * 37) % 92 + 3}%`,
    size: 3 + ((i * 7) % 4),
    delay: (i * 47) % 400,
    dur: 250 + ((i * 31) % 300),
  }));
  const shooting = [
    { top: "18%", left: "10%", delay: 120 },
    { top: "55%", left: "40%", delay: 380 },
    { top: "32%", left: "65%", delay: 600 },
  ];
  return (
    <>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] will-change-transform animate-star-twinkle"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}ms`,
            animationDuration: `${s.dur}ms`,
          }}
        />
      ))}
      {shooting.map((s, i) => (
        <span
          key={`shoot-${i}`}
          className="absolute h-[2px] w-[60px] rounded-full bg-gradient-to-r from-transparent via-white/70 to-white will-change-transform animate-shooting-star"
          style={{ top: s.top, left: s.left, animationDelay: `${s.delay}ms` }}
        />
      ))}
    </>
  );
}

/* ---------------- Rain ---------------- */
function RainOverlay() {
  const drops = Array.from({ length: 14 }).map((_, i) => ({
    left: `${(i * 7.3) % 100}%`,
    delay: (i * 37) % 300,
    dur: 400 + ((i * 53) % 250),
    opacity: 0.7 + ((i * 11) % 3) / 10,
  }));
  return (
    <>
      {drops.map((d, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-[1.5px] rounded-full bg-sky-400 dark:bg-sky-300 will-change-transform animate-rain-drop"
          style={{
            left: d.left,
            opacity: d.opacity,
            animationDelay: `${d.delay}ms`,
            animationDuration: `${d.dur}ms`,
          }}
        />
      ))}
    </>
  );
}

/* ---------------- Snow ---------------- */
function SnowOverlay() {
  const flakes = Array.from({ length: 10 }).map((_, i) => ({
    left: `${(i * 11) % 95 + 2}%`,
    delay: (i * 90) % 500,
    size: 5 + ((i * 3) % 3),
  }));
  return (
    <>
      {flakes.map((f, i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] will-change-transform animate-snow-fall"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: 0.9,
            animationDelay: `${f.delay}ms`,
          }}
        />
      ))}
    </>
  );
}

/* ---------------- Thunder ---------------- */
function ThunderOverlay() {
  return (
    <div
      className="absolute inset-0 animate-thunder-flash"
      style={{ background: "radial-gradient(ellipse at center, #fffbe6 0%, #ffffff 60%, transparent 100%)" }}
    />
  );
}
