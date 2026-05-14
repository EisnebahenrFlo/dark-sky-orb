import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  kein: "bg-muted text-muted-foreground border-border",
  schwach: "bg-muted text-muted-foreground border-border",
  mäßig: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  massig: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  hoch: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  extrem: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function ConvectionBadge({ potenzial }: { potenzial: string }) {
  const tone = TONES[potenzial?.toLowerCase()] ?? TONES.schwach;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        tone,
      )}
    >
      {potenzial}
    </span>
  );
}
