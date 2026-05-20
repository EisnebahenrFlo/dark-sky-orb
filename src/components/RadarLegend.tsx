import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";

const GRADIENT =
  "linear-gradient(to right, transparent, oklch(0.85 0.10 240 / 0.7), oklch(0.65 0.15 240), oklch(0.55 0.18 235), oklch(0.85 0.18 90), oklch(0.7 0.20 50))";

export function RadarLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass mt-3 overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
          Legende
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3">
            <div
              className="h-2.5 w-full rounded-full"
              style={{ background: GRADIENT }}
              aria-hidden
            />
            <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Leicht</span>
              <span>Mäßig</span>
              <span>Stark</span>
              <span>Heftig</span>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground/80">
              Niederschlag in dBZ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
