import {
  AlertTriangle,
  Brain,
  CalendarClock,
  Gauge,
  Globe,
  Layers,
  MapPin,
  Plane,
  RefreshCw,
  Split,
  Wind,
  Zap,
} from "lucide-react";
import { useSynoptikAnalysis } from "@/hooks/useSynoptikAnalysis";
import { HeroCard } from "@/components/synoptik/HeroCard";
import { SectionCard } from "@/components/synoptik/SectionCard";
import { ConvectionBadge } from "@/components/synoptik/ConvectionBadge";
import { useWeather } from "@/contexts/WeatherContext";

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
        <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function AnalysePage() {
  const { data: weather, location } = useWeather();
  const { data, loading, error, refresh, lastUpdated } = useSynoptikAnalysis();

  if (!weather) {
    return (
      <div className="grid h-64 place-items-center text-muted-foreground">
        Lade Wetterdaten…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Brain className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Synoptische KI-Analyse für{" "}
          <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>

      {/* Initial loading */}
      {loading && !data && (
        <>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-muted" />
            <p className="mt-4 text-sm text-muted-foreground">KI analysiert die Wetterlage…</p>
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Analyse fehlgeschlagen</span>
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
        <>
          <HeroCard
            highlight={data.highlight}
            confidenceScore={data.confidence?.score ?? 0}
            confidenceReason={data.confidence?.begründung}
          />

          <SectionCard
            icon={Globe}
            title="Großwetterlage"
            subtitle={data.großwetterlage?.klassifikation}
          >
            {data.großwetterlage?.beschreibung}
          </SectionCard>

          <SectionCard
            icon={Layers}
            title="Höhenstruktur 500 hPa"
            subtitle={data.höhenstruktur_500hPa?.muster}
          >
            {data.höhenstruktur_500hPa?.beschreibung}
          </SectionCard>

          <SectionCard icon={Gauge} title="Bodendruck" subtitle={data.bodendruck?.muster}>
            {data.bodendruck?.beschreibung}
          </SectionCard>

          <SectionCard icon={Wind} title="Luftmasse" subtitle={data.luftmasse?.klassifikation}>
            {data.luftmasse?.begründung}
          </SectionCard>

          {data.fronten_aktivität?.vorhanden ? (
            <SectionCard icon={Split} title="Fronten" subtitle={data.fronten_aktivität.typ}>
              {data.fronten_aktivität.auswirkung}
            </SectionCard>
          ) : (
            <SectionCard icon={Split} title="Fronten">
              Keine markante Frontaktivität.
            </SectionCard>
          )}

          <SectionCard icon={Zap} title="Konvektion">
            <div className="flex flex-wrap items-center gap-2">
              <ConvectionBadge potenzial={data.konvektion?.potenzial ?? "kein"} />
              {data.konvektion?.zeitraum && (
                <span className="text-xs text-muted-foreground">{data.konvektion.zeitraum}</span>
              )}
            </div>
            <p className="mt-3">{data.konvektion?.begründung}</p>
            {data.konvektion?.typ && (
              <p className="mt-1 text-sm text-muted-foreground">Typ: {data.konvektion.typ}</p>
            )}
          </SectionCard>

          {data.regionale_besonderheiten && data.regionale_besonderheiten.length > 0 && (
            <SectionCard icon={MapPin} title="Regionale Besonderheiten">
              <ul className="list-disc space-y-1 pl-5">
                {data.regionale_besonderheiten.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </SectionCard>
          )}

          {data.jet_stream?.relevant && (
            <SectionCard icon={Plane} title="Jet Stream">
              {data.jet_stream.beschreibung}
            </SectionCard>
          )}

          <SectionCard icon={CalendarClock} title="Entwicklung">
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nächste 24h
                </div>
                <p className="mt-1">{data.entwicklung?.next_24h}</p>
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nächste 48h
                </div>
                <p className="mt-1">{data.entwicklung?.next_48h}</p>
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Trend 3–7 Tage
                </div>
                <p className="mt-1">{data.entwicklung?.trend_3_7d}</p>
              </div>
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div className="italic">
              {lastUpdated ? `Letzte Analyse: ${relMin(lastUpdated)}` : "—"}
              {data.cached && (
                <span className="ml-2 not-italic">(aus Cache, max. 30 Min alt)</span>
              )}
            </div>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Neu analysieren
            </button>
          </div>
        </>
      )}
    </div>
  );
}
