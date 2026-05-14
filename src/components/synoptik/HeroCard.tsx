import { ConfidenceBadge } from "./ConfidenceBadge";

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
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ConfidenceBadge score={confidenceScore} reason={confidenceReason} />
      </div>
      <p className="font-display text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl sm:leading-snug pr-32 sm:pr-40">
        {highlight}
      </p>
      {confidenceReason && (
        <p className="mt-3 text-xs text-muted-foreground sm:text-sm">{confidenceReason}</p>
      )}
    </div>
  );
}
