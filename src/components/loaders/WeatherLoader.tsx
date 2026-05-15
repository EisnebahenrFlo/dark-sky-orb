import { WeatherScene } from "./WeatherScene";

interface Props {
  label?: string;
  city?: string;
  compact?: boolean;
}

export function WeatherLoader({ label, city, compact = false }: Props) {
  const text = label ?? (city ? `Lädt Daten für ${city}…` : "Wetterdaten werden geladen…");
  return (
    <div
      className={`glass animate-fade-in flex flex-col items-center justify-center gap-5 rounded-3xl border border-border/60 ${
        compact ? "p-6" : "p-10 sm:p-12"
      }`}
    >
      <WeatherScene size={compact ? "sm" : "md"} />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}
