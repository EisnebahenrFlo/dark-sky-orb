import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional ARIA label for the tablist. */
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Einheitlicher Segmented Control. Nutzt Design-Tokens (muted/background/foreground),
 * funktioniert in Light + Dark. Ersetzt die zuvor hardcoded hellblauen Inline-Styles
 * in Vorhersage- und Analyse-Page.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  size = "md",
}: Props<T>) {
  const pad = size === "sm" ? "py-1.5 text-[11px]" : "py-[7px] text-[12px]";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex w-full rounded-[10px] bg-muted/60 p-[3px] ring-1 ring-border/40",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 cursor-pointer rounded-lg border-0 px-2 font-semibold transition-all",
              pad,
              active
                ? "bg-background text-foreground shadow-sm"
                : "bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
