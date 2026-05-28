import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Einheitliches Badge-System für Status- und Tonalitäts-Hinweise.
 * Verwendet semantische Töne (oklch-basierte Farben), damit Light/Dark konsistent sind.
 *
 * Tone-Mapping:
 * - neutral: graue Meta-Info (z. B. "Modell")
 * - info:    blaue Hinweise (z. B. "BETA")
 * - success: grüne Bestätigung (z. B. "Hoch", "LIVE OK")
 * - warn:    gelbe Aufmerksamkeit (z. B. "DEV", "Mittel")
 * - danger:  rote Warnung (z. B. amtliche Warnung)
 * - live:    rote Pulsanzeige (Echtzeit-Stream)
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 font-semibold tabular-nums whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-foreground/10 text-foreground/80",
        info: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        warn: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
        danger: "bg-red-500/15 text-red-700 dark:text-red-300",
        live: "bg-red-500 text-white",
      },
      size: {
        xs: "text-[10px] px-1.5 py-0.5 rounded",
        sm: "text-[11px] px-2 py-0.5 rounded-md",
        md: "text-xs px-2.5 py-1 rounded-full",
      },
      uppercase: {
        true: "uppercase tracking-wider",
        false: "",
      },
      pulse: {
        true: "animate-pulse",
        false: "",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "sm",
      uppercase: false,
      pulse: false,
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({
  className,
  tone,
  size,
  uppercase,
  pulse,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ tone, size, uppercase, pulse }), className)}
      {...props}
    >
      {children}
    </span>
  );
}
