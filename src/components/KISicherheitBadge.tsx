import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/ui/status-badge";

export function KISicherheitBadge({ confidence }: { confidence: number }) {
  const { label, tone } =
    confidence >= 71
      ? { label: "Hoch", tone: "success" as const }
      : confidence >= 41
        ? { label: "Mittel", tone: "warn" as const }
        : { label: "Gering", tone: "danger" as const };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">KI-Sicherheit</span>
      <StatusBadge tone={tone} size="sm">
        {label} {confidence}%
      </StatusBadge>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Was bedeutet KI-Sicherheit?"
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-[200px] text-xs">
              Wie sicher ist die KI-Einschätzung? Hängt von Datenqualität und Wetterkomplexität ab.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
