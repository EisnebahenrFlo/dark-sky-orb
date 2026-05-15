import { AlertTriangle } from "lucide-react";

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
          <div
            className="absolute inset-0 rounded-full animate-pulse-glow"
            style={{
              background:
                "radial-gradient(circle, oklch(0.75 0.18 70 / 0.45) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
          <AlertTriangle
            className="relative h-20 w-20 text-accent animate-pulse-glow"
            strokeWidth={1.5}
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Risiken werden ausgewertet…
        </p>
      </div>
      <ShimmerCard height={140} />
      <ShimmerCard height={96} />
      <ShimmerCard height={96} />
    </div>
  );
}
