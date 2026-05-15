import { useEffect, useState } from "react";
import { Cloud, Sun, Zap } from "lucide-react";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setFading(true), 1500);
    const t2 = window.setTimeout(() => setVisible(false), 2000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] grid place-items-center transition-opacity duration-500 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at top, var(--bg-grad-1), transparent 60%), radial-gradient(ellipse at bottom right, var(--bg-grad-2), transparent 55%), var(--background)",
      }}
      aria-hidden={fading}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-32 w-40">
          <Sun
            className="absolute left-2 top-2 h-14 w-14 text-accent animate-spin-slow"
            strokeWidth={1.5}
          />
          <Cloud
            className="absolute left-1/2 top-6 h-20 w-20 -translate-x-1/2 text-primary animate-float drop-shadow-xl"
            strokeWidth={1.5}
          />
          <Zap
            className="absolute right-3 top-12 h-8 w-8 text-accent animate-pulse-glow"
            style={{ animationDelay: "2s" }}
            strokeWidth={1.75}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 flex gap-2"
            style={{ top: "84px" }}
          >
            {[0, 0.3, 0.6, 0.9].map((d, i) => (
              <span
                key={i}
                className="block h-3 w-1 rounded-full bg-primary/70 animate-rain"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">
            <span className="text-primary">Meteo</span>
            <span className="text-accent">Flo</span>
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            Wetter mit KI-Analyse
          </p>
        </div>
      </div>
    </div>
  );
}
