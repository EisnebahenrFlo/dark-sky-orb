import { Sun } from "lucide-react";

interface Props {
  /** UV index value (0..). Pass undefined or 0 at night for the "not active" state. */
  value: number | undefined;
  /** Whether it's currently daytime — when false, show "not active". */
  isDay?: boolean;
}

function uvMeta(uv: number): { label: string; color: string } {
  if (uv >= 11) return { label: "Extrem", color: "#a855f7" };
  if (uv >= 8) return { label: "Sehr hoch", color: "#ef4444" };
  if (uv >= 6) return { label: "Hoch", color: "#f97316" };
  if (uv >= 3) return { label: "Mittel", color: "#fbbf24" };
  return { label: "Niedrig", color: "#10b981" };
}

export function UvIndexStat({ value, isDay = true }: Props) {
  const uv = value ?? 0;

  // Nachts (oder kein Wert in der Nacht): Karte komplett ausblenden
  if (!isDay && uv <= 0) return null;

  const meta = uv > 0 ? uvMeta(uv) : { label: "Minimal", color: "#10b981" };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
        UV-Index
      </div>
      <div
        className="font-display text-2xl font-medium tabular-nums"
        style={{ color: meta.color }}
      >
        {Math.round(uv)}
      </div>
      <div className="mt-0.5 text-xs" style={{ color: meta.color }}>
        {meta.label}
      </div>
    </div>
  );
}
