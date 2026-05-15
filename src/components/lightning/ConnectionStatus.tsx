interface Props {
  isConnected: boolean;
  failed: boolean;
  onRetry: () => void;
}

export function ConnectionStatus({ isConnected, failed, onRetry }: Props) {
  if (failed) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <span className="text-foreground">Verbindung fehlgeschlagen</span>
        <button
          onClick={onRetry}
          className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground"
        >
          Erneut
        </button>
      </div>
    );
  }
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        <span className="text-muted-foreground">Verbindung verloren – reconnect…</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="text-foreground">Live</span>
    </div>
  );
}
