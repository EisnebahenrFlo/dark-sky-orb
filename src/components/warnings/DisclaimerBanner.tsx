import { Info } from "lucide-react";

const SOURCES = [
  { label: "DWD", href: "https://www.dwd.de/DE/wetter/warnungen/warnungen_node.html" },
  { label: "GeoSphere AT", href: "https://warnungen.geosphere.at/" },
  { label: "MeteoSwiss", href: "https://www.meteoschweiz.admin.ch/wetter/gefahren.html" },
  { label: "Protezione Civile", href: "https://www.protezionecivile.gov.it/it/" },
];

export function DisclaimerBanner({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground sm:p-5">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
        <div className="space-y-2">
          <p>{text}</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">Offizielle Quellen:</span>
            {SOURCES.map((s, i) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                >
                  {s.label}
                </a>
                {i < SOURCES.length - 1 && <span className="text-border">·</span>}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
