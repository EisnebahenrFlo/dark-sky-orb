import { CircleMarker } from "react-leaflet";
import type { BlitzStrike } from "@/lib/blitzortungDecoder";

interface AgeStyle {
  radius: number;
  color: string;
  fillOpacity: number;
  pulse: boolean;
}

export function ageStyle(ageMs: number): AgeStyle | null {
  if (ageMs < 5_000) return { radius: 8, color: "#fde047", fillOpacity: 0.9, pulse: true };
  if (ageMs < 60_000) return { radius: 5, color: "#fb923c", fillOpacity: 0.7, pulse: false };
  if (ageMs < 10 * 60_000) return { radius: 4, color: "#dc2626", fillOpacity: 0.5, pulse: false };
  if (ageMs < 30 * 60_000) return { radius: 3, color: "#7f1d1d", fillOpacity: 0.3, pulse: false };
  return null;
}

interface Props {
  strike: BlitzStrike;
  now: number;
}

export function StrikeMarker({ strike, now }: Props) {
  const age = now - strike.time;
  const style = ageStyle(age);
  if (!style) return null;
  return (
    <CircleMarker
      center={[strike.lat, strike.lon]}
      radius={style.radius}
      pathOptions={{
        color: style.color,
        fillColor: style.color,
        fillOpacity: style.fillOpacity,
        weight: style.pulse ? 2 : 1,
        opacity: Math.min(1, style.fillOpacity + 0.1),
      }}
      className={style.pulse ? "lightning-strike-pulse" : undefined}
    />
  );
}
