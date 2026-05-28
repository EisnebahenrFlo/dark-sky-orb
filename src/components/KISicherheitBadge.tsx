import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui/status-badge";

export function KISicherheitBadge({
  confidence,
  models,
  spreadTemp,
}: {
  confidence: number;
  models?: string[];
  spreadTemp?: number;
}) {
  const { label, tone } =
    confidence >= 71
      ? { label: "Hoch", tone: "success" as const }
      : confidence >= 41
        ? { label: "Mittel", tone: "warn" as const }
        : { label: "Gering", tone: "danger" as const };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-foreground/80">KI-Sicherheit</span>
      <StatusBadge tone={tone} size="md" className="font-semibold">
        {label} · {confidence}%
      </StatusBadge>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Was bedeutet KI-Sicherheit?"
              className="grid h-6 w-6 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-[240px] space-y-1 text-xs">
              <p>
                Zeigt, wie stark die Vorhersage­modelle übereinstimmen. Niedriger Wert =
                Modelle uneinig (z.B. wechselhafte Lage, Schauer­situation).
              </p>
              {models && models.length > 0 && (
                <p className="text-foreground/70">Modelle: {models.length}</p>
              )}
              {spreadTemp != null && spreadTemp > 0 && (
                <p className="text-foreground/70">Temp-Spread: ±{spreadTemp.toFixed(1)} K</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
