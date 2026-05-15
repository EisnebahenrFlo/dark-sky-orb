import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { useWeather } from "@/contexts/WeatherContext";
import { UnsupportedLocationNotice } from "@/components/PageState";
import { RiskHero } from "@/components/warnings/RiskHero";
import { WarningCard } from "@/components/warnings/WarningCard";
import { DisclaimerBanner } from "@/components/warnings/DisclaimerBanner";
import { colorClasses, type RiskColorKey } from "@/components/warnings/colors";
import { WarningsLoader } from "@/components/loaders/WarningsLoader";
import { WeatherLoader } from "@/components/loaders/WeatherLoader";

function relMin(ts: number) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "gerade eben";
  if (m === 1) return "vor 1 Min";
  return `vor ${m} Min`;
}

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

export function WarnungenPage() {
  const { data: weather, location, errorCode } = useWeather();
  const { data, loading, error, refresh, lastUpdated } = useRiskWarningsCtx();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 280);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (errorCode === "unsupported_location") {
    return <UnsupportedLocationNotice />;
  }

  if (!weather) {
    return <WeatherLoader city={location.name} />;
  }

  const stickyColor = data
    ? colorClasses[(data.gewitter_risiko_6h.color as RiskColorKey) ?? "green"] ?? colorClasses.green
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Warnungen für{" "}
          <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>

      {/* Sticky compact risk indicator */}
      {data && stickyColor && scrolled && (
        <div className="sticky top-2 z-20 -mx-1">
          <div
            className={`glass flex items-center justify-between gap-3 rounded-full border ${stickyColor.border} bg-background/80 px-4 py-2 shadow-lg backdrop-blur`}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Gewitter-Risiko 6h:</span>
              <span className={`font-display text-base font-semibold ${stickyColor.text}`}>
                {data.gewitter_risiko_6h.score}
              </span>
              <span
                className={`rounded-full ${stickyColor.bg} ${stickyColor.text} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}
              >
                {data.gewitter_risiko_6h.level}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Initial loading */}
      {loading && !data && <WarningsLoader />}

      {/* Error */}
      {error && !data && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Warnungen konnten nicht geladen werden</span>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" /> Erneut versuchen
          </button>
        </div>
      )}

      {data && (
        <div className={`relative space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {loading && (
            <div className="pointer-events-none sticky top-2 z-30 -mx-1 flex justify-end">
              <div className="glass inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Wird neu geprüft…
              </div>
            </div>
          )}
          <RiskHero risk={data.gewitter_risiko_6h} />

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Aktive Warnungen · 12 h
              </h2>
              {data.warnungen_12h.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {data.warnungen_12h.length}{" "}
                  {data.warnungen_12h.length === 1 ? "Warnung" : "Warnungen"}
                </span>
              )}
            </div>

            {data.warnungen_12h.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/5 p-5 sm:p-6">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-medium text-foreground">Keine aktiven Warnungen</p>
                  <p className="text-sm text-muted-foreground">
                    Aktuell sind keine markanten Wetterereignisse zu erwarten.
                  </p>
                </div>
              </div>
            ) : (
              data.warnungen_12h.map((w, i) => <WarningCard key={`${w.id}_${i}`} warning={w} />)
            )}
          </section>

          {data.summary && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
              <p className="font-display text-base italic leading-relaxed text-foreground/90 sm:text-lg">
                {data.summary}
              </p>
            </div>
          )}

          <DisclaimerBanner text={data.disclaimer} />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div className="italic">
              {lastUpdated ? `Letzte Prüfung: ${relMin(lastUpdated)}` : "—"}
              {data.cached && (
                <span className="ml-2 not-italic">(aus Cache, max. 15 Min alt)</span>
              )}
            </div>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Neu prüfen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
