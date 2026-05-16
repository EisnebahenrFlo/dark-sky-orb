import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { useWeather } from "@/contexts/WeatherContext";

type AnimType = "rain" | "snow" | "thunder" | "day" | "night";

function getAnimType(code: number | undefined, precip: number | undefined, isDay: number | undefined): AnimType {
  const c = code ?? 0;
  if (c >= 95 && c <= 99) return "thunder";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if ((precip ?? 0) > 0.5 || (c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  return isDay ? "day" : "night";
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)") && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WeatherTabTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data } = useWeather();
  const type = getAnimType(data?.current?.weather_code, data?.current?.precipitation, data?.current?.is_day);

  const [animKey, setAnimKey] = useState(pathname);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setAnimKey(pathname);
      return;
    }
    setShowOverlay(true);
    setAnimKey(pathname);
    const t = setTimeout(() => setShowOverlay(false), 800);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div className="relative">
      {showOverlay && <WeatherAnimationOverlay type={type} />}
      <div key={animKey} className="animate-tab-content-enter">
        {children}
      </div>
    </div>
  );
}

function WeatherAnimationOverlay({ type }: { type: AnimType }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {type === "rain" && <RainOverlay />}
      {type === "snow" && <SnowOverlay />}
      {type === "thunder" && <ThunderOverlay />}
      {type === "day" && <CloudOverlay />}
      {type === "night" && <StarsOverlay />}
    </div>
  );
}

function RainOverlay() {
  const drops = Array.from({ length: 7 });
  return (
    <>
      {drops.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-[10px] w-[1.5px] rounded-full bg-sky-400/70 animate-rain-drop"
          style={{
            left: `${10 + i * 12}%`,
            animationDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </>
  );
}

function SnowOverlay() {
  const flakes = Array.from({ length: 6 });
  return (
    <>
      {flakes.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-1 w-1 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.8)] animate-snow-fall"
          style={{
            left: `${8 + i * 15}%`,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </>
  );
}

function ThunderOverlay() {
  return <div className="absolute inset-0 bg-white animate-thunder-flash" />;
}

function CloudOverlay() {
  return (
    <div className="absolute top-4 -right-[220px] h-[80px] w-[200px] rounded-full bg-white/40 blur-xl animate-cloud-sweep" />
  );
}

function StarsOverlay() {
  const stars = Array.from({ length: 8 });
  return (
    <>
      {stars.map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-white animate-star-twinkle"
          style={{
            top: `${(i * 47) % 80 + 5}%`,
            left: `${(i * 31) % 90 + 5}%`,
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </>
  );
}
