import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/20 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {children && <div className="mt-3 text-sm leading-relaxed text-foreground/85">{children}</div>}
    </div>
  );
}
