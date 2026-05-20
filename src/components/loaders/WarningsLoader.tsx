import { AlertTriangle } from "lucide-react";
import { LoadingProgress, type LoadingPhase } from "./LoadingProgress";
import { RotatingLoadingMessage } from "./RotatingLoadingMessage";

const WARNINGS_LOADING_MESSAGES = [
  "Scanne Risikolagen…",
  "Bewerte konvektive Indizes…",
  "Vergleiche mit DWD-Schwellen…",
  "Frage den Sturm nach Details…",
  "Sortiere Unwetter nach Wichtigkeit…",
  "Prüfe, ob Petrus es ernst meint…",
  "Berechne Niederschlags-Wahrscheinlichkeiten…",
  "Spüre dem Bodendruck nach…",
] as const;

const WARNINGS_PHASES: LoadingPhase[] = [
  { label: "Risikodaten prüfen", targetProgress: 25, duration: 500 },
  { label: "KI bewertet Lage", targetProgress: 90, duration: 3500 },
  { label: "Warnungen sortieren", targetProgress: 100, duration: 300 },
];

function ShimmerCard({ height = 96 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl border border-border bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-shimmer"
      style={{ height }}
    />
  );
}

export function WarningsLoader() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl border border-border/60 p-10">
        <div className="relative h-20 w-20">
          <AlertTriangle className="relative h-20 w-20 text-accent" strokeWidth={1.5} />
        </div>
        <RotatingLoadingMessage messages={WARNINGS_LOADING_MESSAGES} />
        <LoadingProgress phases={WARNINGS_PHASES} />
      </div>
      <ShimmerCard height={140} />
      <ShimmerCard height={96} />
      <ShimmerCard height={96} />
    </div>
  );
}
