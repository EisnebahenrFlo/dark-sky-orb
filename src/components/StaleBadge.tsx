import { Clock } from "lucide-react";

export function StaleBadge({ ageMinutes }: { ageMinutes?: number }) {
  const label =
    typeof ageMinutes === "number" && ageMinutes > 0
      ? `Daten aktualisiert vor ${ageMinutes} Min`
      : "Daten möglicherweise nicht aktuell";
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>{label}</span>
    </div>
  );
}
