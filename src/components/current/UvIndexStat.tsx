import { Sun } from "lucide-react";

interface Props {
  /** UV index value (0..). Pass undefined or 0 at night for the "not active" state. */
  value: number | undefined;
  /** Whether it's currently daytime — when false, show "not active". */
  isDay?: boolean;
}

function uvMeta(uv: number): { label: string; color: string } {
  if (uv >= 11) return { label: "Extrem", color: "#a855f7" };
  if (uv >= 8) return { label: "Sehr hoch – Vorsicht", color: "#ef4444" };
  if (uv >= 6) return { label: "Hoch – Sonnenschutz!", color: "#f97316" };
  if (uv >= 3) return { label: "Mittel", color: "#fbbf24" };
  return { label: "Niedrig", color: "#10b981" };
}

export function UvIndexStat({ value, isDay = true }: Props) {
  const inactive = !isDay || value == null || value <= 0;
  const uv = value ?? 0;
  const meta = uvMeta(uv);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
        UV-Index
      </div>
      {inactive ? (
        <>
          <div className="font-display text-3xl font-medium tabular-nums text-muted-foreground">—</div>
          <div className="mt-1 text-xs text-muted-foreground">Nicht aktiv (Nacht)</div>
        </>
      ) : (
        <>
          <div
            className="font-display text-3xl font-medium tabular-nums"
            style={{ color: meta.color }}
          >
            {Math.round(uv)}
          </div>
          <div className="mt-1 text-xs" style={{ color: meta.color }}>
            {meta.label}
          </div>
        </>
      )}
    </div>
  );
}
