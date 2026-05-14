import { cn } from "@/lib/utils";

export function ConfidenceBadge({ score, reason }: { score: number; reason?: string }) {
  const tone =
    score >= 70
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
      : score >= 40
        ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
        : "bg-red-500/15 text-red-500 border-red-500/30";
  return (
    <span
      title={reason}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        tone,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Confidence {score}%
    </span>
  );
}
