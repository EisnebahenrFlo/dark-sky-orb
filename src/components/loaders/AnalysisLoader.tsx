import { Brain, Sparkles } from "lucide-react";
import { LoadingProgress, type LoadingPhase } from "./LoadingProgress";
import { RotatingLoadingMessage } from "./RotatingLoadingMessage";

const ANALYSIS_LOADING_MESSAGES = [
  "Berechne Tropopausen-Stabilität…",
  "Frage Petrus nach Details…",
  "Lese Wolkenstrukturen…",
  "Sortiere Isobaren der Reihe nach…",
  "Werfe Würfel auf die Großwetterlage…",
  "Studiere 500hPa-Geopotential…",
  "Spüre dem Jetstream nach…",
  "Befrage Kaltfronten persönlich…",
  "Setze den Synoptiker-Hut auf…",
  "Übersetze atmosphärisches Kauderwelsch…",
  "Lese CAPE-Werte zwischen den Zeilen…",
  "Frage die Hochs nach ihren Plänen…",
] as const;

const ANALYSIS_PHASES: LoadingPhase[] = [
  { label: "Wetterdaten sammeln", targetProgress: 20, duration: 600 },
  { label: "KI analysiert Synoptik", targetProgress: 90, duration: 4000 },
  { label: "Ergebnis formatieren", targetProgress: 100, duration: 400 },
];

function ShimmerCard({ height = 96 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl border border-border bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%] animate-shimmer"
      style={{ height }}
    />
  );
}

export function AnalysisLoader() {
  const sparkles = [
    { top: "0%", left: "10%", delay: "0s" },
    { top: "10%", right: "5%", delay: "0.4s" },
    { bottom: "5%", left: "0%", delay: "0.8s" },
    { bottom: "0%", right: "15%", delay: "1.2s" },
    { top: "45%", right: "-10%", delay: "1.6s" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass flex flex-col items-center gap-4 rounded-3xl border border-border/60 p-10">
        <div className="relative h-20 w-20">
          <Brain className="relative h-20 w-20 text-accent" strokeWidth={1.5} />
          {sparkles.map((s, i) => (
            <Sparkles
              key={i}
              className="absolute h-3 w-3 text-accent animate-sparkle"
              style={{ ...s, animationDelay: s.delay } as React.CSSProperties}
              strokeWidth={2}
            />
          ))}
        </div>
        <RotatingLoadingMessage messages={ANALYSIS_LOADING_MESSAGES} />
        <LoadingProgress phases={ANALYSIS_PHASES} />
      </div>
      <ShimmerCard height={120} />
      <ShimmerCard height={96} />
      <ShimmerCard height={96} />
      <ShimmerCard height={88} />
    </div>
  );
}
