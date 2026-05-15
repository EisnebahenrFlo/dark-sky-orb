import { Cloud, Sun } from "lucide-react";

interface Props {
  size?: "sm" | "md" | "lg";
}

export function WeatherScene({ size = "md" }: Props) {
  const cloud = size === "lg" ? 72 : size === "md" ? 48 : 36;
  const sun = size === "lg" ? 36 : size === "md" ? 24 : 18;
  const drop = size === "lg" ? 4 : 3;

  return (
    <div className="relative inline-block" aria-hidden="true">
      <Sun
        className="absolute -right-3 -top-2 text-accent animate-pulse-glow"
        style={{ width: sun, height: sun }}
        strokeWidth={1.75}
      />
      <Cloud
        className="relative text-primary animate-float drop-shadow-md"
        style={{ width: cloud, height: cloud }}
        strokeWidth={1.5}
      />
      <div
        className="absolute left-0 right-0 flex justify-center gap-1.5"
        style={{ top: cloud * 0.85 }}
      >
        {[0, 0.3, 0.6, 0.9].map((delay, i) => (
          <span
            key={i}
            className="block rounded-full bg-primary/70 animate-rain"
            style={{
              width: drop,
              height: drop * 2.5,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
