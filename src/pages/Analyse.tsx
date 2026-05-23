import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
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
import { useSynoptikAnalysis, type SynoptikErrorCode } from "@/hooks/useSynoptikAnalysis";
import { getWeatherModelLabel } from "@/lib/weather";
import { HeroCard } from "@/components/synoptik/HeroCard";
import { SectionCard } from "@/components/synoptik/SectionCard";
import { ConvectionBadge } from "@/components/synoptik/ConvectionBadge";
import { useWeather } from "@/contexts/WeatherContext";
import { UnsupportedLocationNotice } from "@/components/PageState";
import { AnalysisLoader } from "@/components/loaders/AnalysisLoader";
import { WeatherLoader } from "@/components/loaders/WeatherLoader";
import { AnalysisDisclaimer } from "@/components/analysis/AnalysisDisclaimer";
import { StaleBadge } from "@/components/StaleBadge";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { PullToRefresh } from "@/components/PullToRefreshIndicator";

const formatHighlight = (text: string) => text.replaceAll(";", " ·");

function relMin(ts: number) {

  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "gerade eben";
  if (m === 1) return "vor 1 Min";
  return `vor ${m} Min`;
}

const ERROR_COPY: Record<SynoptikErrorCode, { title: string; body: string }> = {
  TIMEOUT: {
    title: "Analyse dauert ungewöhnlich lange",
    body: "Analyse dauert ungewöhnlich lange. Bitte erneut versuchen.",
  },
  RATE_LIMIT: {
    title: "KI-Dienste vorübergehend überlastet",
    body: "Das liegt an Anthropic, nicht an MeteoFlo. Bitte in ein paar Minuten erneut versuchen.",
  },
  API_ERROR: {
    title: "KI-Dienste vorübergehend überlastet",
    body: "Das liegt an Anthropic, nicht an MeteoFlo. Bitte in ein paar Minuten erneut versuchen.",
  },
  PARSE_ERROR: {
    title: "Analyse unvollständig",
    body: "Analyse konnte nicht erstellt werden.",
  },
  INVALID_RESPONSE: {
    title: "Analyse unvollständig",
    body: "Analyse konnte nicht erstellt werden.",
  },
  BAD_REQUEST: {
    title: "Analyse nicht möglich",
    body: "Für diesen Standort konnte keine Analyse erstellt werden.",
  },
  NETWORK: {
    title: "Verbindungsproblem",
    body: "Verbindungsproblem. Bitte erneut versuchen.",
  },
  UNKNOWN: {
    title: "Etwas ist schiefgelaufen",
    body: "Verbindungsproblem. Bitte erneut versuchen.",
  },
};

function useDebouncedAction(action: () => void, ms = 5000) {
  const [disabled, setDisabled] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
  const trigger = useCallback(() => {
    if (disabled) return;
    setDisabled(true);
    action();
    timeoutRef.current = setTimeout(() => setDisabled(false), ms);
  }, [disabled, action, ms]);
  return { trigger, disabled };
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
  const { data: weather, location, errorCode: weatherErrorCode } = useWeather();
  const { data, loading, error, errorCode, refresh, lastUpdated } = useSynoptikAnalysis();
  const retry = useDebouncedAction(() => refresh(), 5000);
  const refreshAction = useDebouncedAction(() => refresh(), 5000);

  if (weatherErrorCode === "unsupported_location") {
    return <UnsupportedLocationNotice />;
  }

  if (!weather) {
    return <WeatherLoader city={location.name} />;
  }

  const copy = ERROR_COPY[errorCode ?? "UNKNOWN"];

  const weatherCode = (weather as any)?.current?.weather_code;
  const handleRefresh = () => refreshAction.trigger();

  return (
    <PullToRefresh onRefresh={handleRefresh} isRefreshing={loading} weatherCode={weatherCode}>
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Brain className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Synoptische KI-Analyse für{" "}
          <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>

      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-border/40 bg-background/80 px-4 py-2 backdrop-blur-md">
        <span className="text-xs text-muted-foreground">
          {lastUpdated ? formatTimestamp(new Date(lastUpdated)) : "—"}
        </span>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshAction.disabled}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Aktualisieren</span>
        </button>
      </div>


      {/* Initial loading: show as long as we have neither data nor error */}
      {!data && !error && <AnalysisLoader />}

      {/* Error */}
      {error && !data && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <AlertCircle className="h-6 w-6 text-foreground/70" strokeWidth={1.75} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">{copy.body}</p>
          </div>
          <button
            onClick={retry.trigger}
            disabled={retry.disabled || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Erneut versuchen
          </button>
        </div>
      )}

      {data && (
        <div className={`relative space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {loading && (
            <div className="pointer-events-none sticky top-2 z-30 -mx-1 flex justify-end">
              <div className="glass inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg backdrop-blur">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Wird neu analysiert…
              </div>
            </div>
          )}
          <HeroCard
            highlight={formatHighlight(data.highlight)}
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

          <AnalysisDisclaimer />

          {data.stale && (
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <StaleBadge ageMinutes={data.ageMinutes} />
            </div>
          )}


          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div className="italic">
              {lastUpdated ? `Letzte Analyse: ${relMin(lastUpdated)}` : "—"}
              {data.cached && (
                <span className="ml-2 not-italic">(aus Cache, max. 30 Min alt)</span>
              )}
            </div>
            <button
              onClick={refreshAction.trigger}
              disabled={loading || refreshAction.disabled}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-foreground transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Neu analysieren
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-xs text-muted-foreground">
        Datenquelle: {getWeatherModelLabel(location.country_code)}
      </div>
    </div>
    </PullToRefresh>
  );
}
