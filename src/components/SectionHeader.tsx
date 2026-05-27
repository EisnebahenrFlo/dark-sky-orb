import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  accessory,
}: {
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between px-1">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
        {accessory}
      </div>
      {subtitle && (
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{subtitle}</span>
      )}
    </div>
  );
}
