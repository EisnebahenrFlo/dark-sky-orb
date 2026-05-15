import { CloudLightning, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function InlineError({
  message = "Daten konnten nicht geladen werden",
  onRetry,
}: Props) {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl p-10 text-center">
      <CloudLightning
        className="h-10 w-10 text-primary animate-float"
        strokeWidth={1.5}
      />
      <p className="text-muted-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}
