import { KISicherheitBadge } from "@/components/KISicherheitBadge";

export function HeroCard({
  highlight,
  confidenceScore,
  confidenceReason,
}: {
  highlight: string;
  confidenceScore: number;
  confidenceReason?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <p className="font-display text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl sm:leading-snug">
        {highlight}
      </p>
      {confidenceReason && (
        <p className="mt-3 text-xs text-muted-foreground sm:text-sm">{confidenceReason}</p>
      )}
      <div className="mt-4">
        <KISicherheitBadge confidence={confidenceScore} />
      </div>
    </div>
  );
}
