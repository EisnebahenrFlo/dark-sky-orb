import { useState, useCallback } from "react";

interface RefreshButtonProps {
  onRefresh: () => Promise<void> | void;
  className?: string;
}

export function RefreshButton({ onRefresh, className = "" }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleClick = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isRefreshing}
      aria-label="Aktualisieren"
      className={
        "inline-flex h-11 w-11 items-center justify-center rounded-full bg-foreground/5 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-foreground/15 disabled:opacity-60 dark:bg-foreground/10 dark:text-foreground/80 dark:hover:bg-foreground/20 " +
        className
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isRefreshing ? "animate-spin" : ""}
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    </button>
  );
}
