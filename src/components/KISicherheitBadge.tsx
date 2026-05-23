import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function KISicherheitBadge({ confidence }: { confidence: number }) {
  const { label, tone } =
    confidence >= 71
      ? { label: "Hoch", tone: "bg-green-500/15 text-green-600 dark:text-green-400" }
      : confidence >= 41
        ? { label: "Mittel", tone: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" }
        : { label: "Gering", tone: "bg-red-500/15 text-red-600 dark:text-red-400" };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">KI-Sicherheit</span>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
          tone,
        )}
      >
        {label} {confidence}%
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="Was bedeutet KI-Sicherheit?">
              <Info className="h-3.5 w-3.5 text-muted-foreground transition-colors hover:text-foreground" />
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
