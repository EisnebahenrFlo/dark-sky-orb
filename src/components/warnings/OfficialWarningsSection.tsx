import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { useOfficialWarnings } from "@/hooks/useOfficialWarnings";
import { OfficialWarningCard } from "./OfficialWarningCard";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function OfficialWarningsSection() {
  const { data, loading, error, refresh } = useOfficialWarnings();

  const sorted = data?.warnings ? [...data.warnings].sort((a, b) => b.level - a.level) : [];

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.75} />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Amtliche Warnungen
          </h2>
        </div>
        {data?.sources && data.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {data.sources.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {loading && !data && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {error && !data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <span>Amtliche Quellen gerade nicht erreichbar – KI-Auswertung unten.</span>
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            aria-label="Erneut versuchen"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}


      {data && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((w) => (
            <OfficialWarningCard key={w.id} warning={w} />
          ))}
        </div>
      )}
    </section>
  );
}
