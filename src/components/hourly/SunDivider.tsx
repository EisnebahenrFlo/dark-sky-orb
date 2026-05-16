import { Sunrise, Sunset } from "lucide-react";

export function SunDivider({ kind, time }: { kind: "sunrise" | "sunset"; time: string }) {
  const Icon = kind === "sunrise" ? Sunrise : Sunset;
  const label = kind === "sunrise" ? "Sonnenaufgang" : "Sonnenuntergang";
  return (
    <div className="my-2 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
      <span className="font-medium tabular-nums text-foreground">
        {label} · {time}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
