import { useEffect, useState, useCallback } from "react";

type Variant = "hero" | "statusbar";

interface RefreshButtonProps {
  onRefresh: () => Promise<void> | void;
  variant: Variant;
  /** Timestamp (ms) of last successful fetch, used by the statusbar variant. */
  lastUpdated?: number;
  className?: string;
  /** Hero variant: text color from the active sky palette (light or dark). */
  heroTextColor?: string;
}

function RefreshIcon({ spinning, size = 16 }: { spinning: boolean; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function formatRelative(ms: number | undefined): string {
  if (!ms) return "Gerade aktualisiert";
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Aktualisiert gerade eben";
  if (mins === 1) return "Aktualisiert vor 1 Min.";
  if (mins < 60) return `Aktualisiert vor ${mins} Min.`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "Aktualisiert vor 1 Std.";
  return `Aktualisiert vor ${hrs} Std.`;
}

export function RefreshButton({ onRefresh, variant, lastUpdated, className = "", heroTextColor }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every minute so the relative timestamp stays fresh.
  useEffect(() => {
    if (variant !== "statusbar") return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [variant]);

  const handleClick = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  if (variant === "hero") {
    // Derive contrast pieces from the active hero palette so the button stays
    // visible against bright clear-day backgrounds AND dark night skies.
    const textColor = heroTextColor ?? "rgba(255,255,255,0.9)";
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isRefreshing}
        aria-label="Aktualisieren"
        className={
          "absolute right-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-70 " +
          className
        }
        style={{ color: textColor }}
      >
        <span
          className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full transition-colors"
          style={{
            background: `color-mix(in oklab, ${textColor} 18%, transparent)`,
            border: `1px solid color-mix(in oklab, ${textColor} 25%, transparent)`,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <RefreshIcon spinning={isRefreshing} size={16} />
        </span>
      </button>
    );
  }

  // statusbar
  return (
    <div
      className={
        "flex items-center justify-between rounded-[12px] " + className
      }
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "9px 14px",
      }}
    >
      <div className="flex items-center gap-2 text-muted-foreground" style={{ fontSize: 12 }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span>{formatRelative(lastUpdated)}</span>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isRefreshing}
        aria-label="Aktualisieren"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-70"
        style={{ color: "#3a7bd5" }}
      >
        <span
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors"
          style={{
            background: "rgba(58,123,213,0.15)",
            border: "1px solid rgba(58,123,213,0.25)",
          }}
        >
          <RefreshIcon spinning={isRefreshing} size={15} />
        </span>
      </button>
    </div>
  );
}
