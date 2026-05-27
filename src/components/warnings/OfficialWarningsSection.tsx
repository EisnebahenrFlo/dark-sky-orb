import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { OfficialWarningCard } from "./OfficialWarningCard";
import { getWarningTiming } from "@/lib/warningTime";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function OfficialWarningsSection() {
  const { data, loading, error } = useOfficialWarningsCtx();

  const { active, upcoming } = useMemo(() => {
    const list = data?.warnings ?? [];
    const now = Date.now();
    const sorted = [...list].sort((a, b) => b.level - a.level);
    const active = sorted.filter((w) => getWarningTiming(w.start, w.end, now).state === "active");
    const upcoming = sorted
      .filter((w) => getWarningTiming(w.start, w.end, now).state === "upcoming")
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return { active, upcoming };
  }, [data?.warnings]);

  const total = active.length + upcoming.length;

  return (
    <section className="space-y-4">
      {/* Section header */}
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
                className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-foreground/80"
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
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-muted-foreground">
            Amtliche Quellen gerade nicht erreichbar – KI-Auswertung unten.
          </span>
        </div>
      )}

      {data && total === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2} />
          <p className="text-sm text-muted-foreground">
            Aktuell keine amtlichen Warnungen für deinen Standort.
          </p>
        </div>
      )}

      {/* Active block */}
      {active.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 px-1">
            <span className="flex h-2 w-2">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-amber-500/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Aktuell aktiv · {active.length}
            </span>
          </div>
          <div className="space-y-3">
            {active.map((w) => (
              <OfficialWarningCard key={w.id} warning={w} variant="hero" />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming timeline */}
      {upcoming.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2 px-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Anstehend · {upcoming.length}
            </span>
          </div>
          <div className="space-y-2">
            {upcoming.map((w) => (
              <OfficialWarningCard key={w.id} warning={w} variant="compact" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
