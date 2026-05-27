interface Props {
  isConnected: boolean;
  failed: boolean;
  onRetry: () => void;
}

export function ConnectionStatus({ isConnected, failed, onRetry }: Props) {
  if (failed) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm ring-1 ring-border/60 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <span className="font-medium text-foreground">Offline</span>
        <button
          onClick={onRetry}
          className="ml-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Erneut
        </button>
      </div>
    );
  }
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm ring-1 ring-border/60 backdrop-blur">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        <span className="font-medium text-foreground">Reconnect…</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs shadow-sm ring-1 ring-border/60 backdrop-blur">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-medium text-foreground">Live</span>
    </div>
  );
}
