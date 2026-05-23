import { useEffect, useRef, useState, type ReactNode } from "react";

interface PullToRefreshIndicatorProps {
  pullProgress: number;
  isRefreshing: boolean;
  weatherCode?: number;
}

function getWeatherPullIcon(code?: number): string {
  if (code === undefined || code === null) return "☁️";
  if (code === 0 || code === 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌦️";
  return "⚡";
}

function WeatherPullIcon({
  weatherCode,
  isRefreshing,
}: {
  weatherCode?: number;
  isRefreshing: boolean;
}) {
  return (
    <span className={`text-xl leading-none ${isRefreshing ? "animate-spin" : ""}`}>
      {getWeatherPullIcon(weatherCode)}
    </span>
  );
}

export function PullToRefreshIndicator({
  pullProgress,
  isRefreshing,
  weatherCode,
}: PullToRefreshIndicatorProps) {
  const reached = pullProgress >= 1;
  const isVisible = pullProgress > 0 || isRefreshing;
  return (
    <div
      className="overflow-hidden transition-all duration-200"
      style={{ height: isVisible ? "48px" : "0px" }}
    >
      <div className="flex h-12 items-center justify-center">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-transform duration-150 ${
            reached && !isRefreshing ? "scale-110 text-primary" : ""
          }`}
          style={{
            transform: isRefreshing
              ? undefined
              : `rotate(${pullProgress * 180}deg) scale(${reached ? 1.1 : 1})`,
            opacity: isRefreshing ? 1 : pullProgress,
            transition: isRefreshing ? "none" : "transform 0.1s ease-out, opacity 0.1s ease-out",
          }}
        >
          <WeatherPullIcon weatherCode={weatherCode} isRefreshing={isRefreshing} />
        </div>
      </div>
    </div>
  );
}

const PULL_THRESHOLD = 60;

interface PullToRefreshProps {
  onRefresh: () => void | Promise<unknown>;
  isRefreshing: boolean;
  weatherCode?: number;
  children: ReactNode;
}

export function PullToRefresh({
  onRefresh,
  isRefreshing,
  weatherCode,
  children,
}: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0) {
        if (e.cancelable) e.preventDefault();
        setPullProgress(Math.min(delta / PULL_THRESHOLD, 1));
      }
    };
    const onTouchEnd = () => {
      if (startYRef.current === null) return;
      if (pullProgress >= 1 && !isRefreshing) {
        onRefresh();
      }
      setPullProgress(0);
      startYRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullProgress, isRefreshing, onRefresh]);

  return (
    <div ref={containerRef}>
      <PullToRefreshIndicator
        pullProgress={pullProgress}
        isRefreshing={isRefreshing}
        weatherCode={weatherCode}
      />
      {children}
    </div>
  );
}
