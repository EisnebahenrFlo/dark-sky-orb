import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";

const GRADIENT =
  "linear-gradient(to right, oklch(0.92 0.04 240 / 0.5), oklch(0.78 0.12 240 / 0.85), oklch(0.62 0.17 235), oklch(0.55 0.20 220), oklch(0.78 0.18 100), oklch(0.68 0.22 50), oklch(0.55 0.24 25))";

const STOPS: { label: string; hint: string }[] = [
  { label: "Leicht", hint: "Nieselregen" },
  { label: "Mäßig", hint: "Regen" },
  { label: "Stark", hint: "Starkregen" },
  { label: "Heftig", hint: "Unwetter" },
];

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
          <span className="font-medium">Legende · Niederschlagsintensität</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3.5">
            <div
              className="h-3 w-full rounded-full ring-1 ring-border/60"
              style={{ background: GRADIENT }}
              aria-hidden
            />
            <div className="mt-1.5 grid grid-cols-4 text-[10px] uppercase tracking-wider text-muted-foreground">
              {STOPS.map((s) => (
                <div key={s.label} className="flex flex-col items-center text-center">
                  <span className="font-medium text-foreground/80">{s.label}</span>
                  <span className="text-[9px] normal-case tracking-normal text-muted-foreground/80">
                    {s.hint}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
