import { useMemo } from "react";
import { Activity } from "lucide-react";

interface Props {
  isConnected: boolean;
  connectedCount: number;
  endpointCount: number;
  failed: boolean;
  onRetry: () => void;
}

export function ConnectionStatus({
  isConnected,
  connectedCount,
  endpointCount,
  failed,
  onRetry,
}: Props) {
  const dotColor = useMemo(() => {
    if (failed) return "bg-destructive";
    if (connectedCount === 0) return "bg-amber-500";
    if (connectedCount < endpointCount) return "bg-amber-400";
    return "bg-emerald-500";
  }, [failed, connectedCount, endpointCount]);

  const label = useMemo(() => {
    if (failed) return "Offline";
    if (connectedCount === 0) return "Verbinde…";
    if (connectedCount < endpointCount) return "Teilweise live";
    return "Live";
  }, [failed, connectedCount, endpointCount]);

  return (
    <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm ring-1 ring-border/60 backdrop-blur">
      <span className="relative flex h-2 w-2">
        {!failed && connectedCount === endpointCount && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
      </span>
      <span className="font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-0.5 tabular-nums text-muted-foreground">
        <Activity className="h-3 w-3" strokeWidth={2} aria-hidden />
        {connectedCount}/{endpointCount}
      </span>
      {failed && (
        <button
          onClick={onRetry}
          className="ml-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Erneut
        </button>
      )}
      {!isConnected && !failed && (
        <button
          onClick={onRetry}
          aria-label="Neu verbinden"
          className="ml-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          ↻
        </button>
      )}
    </div>
  );
}
