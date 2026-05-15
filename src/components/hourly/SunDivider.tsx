import { Sunrise, Sunset } from "lucide-react";

export function SunDivider({ kind, time }: { kind: "sunrise" | "sunset"; time: string }) {
  const Icon = kind === "sunrise" ? Sunrise : Sunset;
  const label = kind === "sunrise" ? "Sonnenaufgang" : "Sonnenuntergang";
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border/60" />
      <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
      <span className="tabular-nums">{label} · {time}</span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}
