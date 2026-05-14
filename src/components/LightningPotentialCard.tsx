import { Zap } from "lucide-react";
import type { HourlyData } from "@/lib/weather";

function levelFor(v: number): { label: string; color: string } {
  if (v >= 100) return { label: "Hoch", color: "var(--destructive)" };
  if (v >= 50) return { label: "Mäßig", color: "var(--accent)" };
  return { label: "Niedrig", color: "var(--muted-foreground)" };
}

export function LightningPotentialCard({ hourly }: { hourly: HourlyData }) {
  const values = (hourly.lightning_potential ?? []).slice(0, 24);
  if (values.length === 0) return null;

  const max = Math.max(...values, 1);
  const peak = Math.max(...values);
  const peakIdx = values.indexOf(peak);
  const peakTime = hourly.time[peakIdx]
    ? new Date(hourly.time[peakIdx]).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const level = levelFor(peak);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
          Gewitter-Potenzial · 24 h
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{ background: `color-mix(in oklab, ${level.color} 18%, transparent)`, color: level.color }}
        >
          {level.label}
        </span>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <div className="font-display text-3xl tabular-nums">{Math.round(peak)}</div>
          <div className="text-xs text-muted-foreground">
            Peak {peakTime ? `· ${peakTime}` : ""}
          </div>
        </div>
        <div className="flex h-12 flex-1 items-end gap-[2px]">
          {values.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(4, (v / max) * 100)}%`,
                background:
                  v >= 100 ? "var(--destructive)" : v >= 50 ? "var(--accent)" : "var(--primary)",
                opacity: v < 10 ? 0.25 : 0.85,
              }}
              title={`${new Date(hourly.time[i]).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · ${safeFixed(v, 0)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
