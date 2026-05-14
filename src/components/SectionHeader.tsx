export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between px-1">
      <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
      {subtitle && (
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{subtitle}</span>
      )}
    </div>
  );
}
