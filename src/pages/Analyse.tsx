import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Brain,
  CalendarClock,
  CheckCircle2,
  Globe,
  Layers,
  MapPin,
  Wind,
  Zap,
} from "lucide-react";
import { useSynoptikAnalysisCtx } from "@/contexts/SynoptikAnalysisContext";
import type { SynoptikErrorCode } from "@/hooks/useSynoptikAnalysis";
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
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { RiskHero } from "@/components/warnings/RiskHero";
import { WarningCard } from "@/components/warnings/WarningCard";
import { OfficialWarningsSection } from "@/components/warnings/OfficialWarningsSection";
import { useThunderstormRisk } from "@/hooks/useThunderstormRisk";

const formatHighlight = (text: string) => text.replaceAll(";", " ·");

function formatRelativeTime(minutes: number): string {
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${Math.round(minutes)} Minuten`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `vor ${h} Std. ${m} Min.` : `vor ${h} Stunden`;
}

function relMin(ts: number) {
  const m = Math.max(0, (Date.now() - ts) / 60000);
  return formatRelativeTime(m);
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

export function AnalysePage() {
  const { data: weather, location, errorCode: weatherErrorCode } = useWeather();
  const { data, loading, error, errorCode, refresh, lastUpdated } = useSynoptikAnalysisCtx();
  const retry = useDebouncedAction(() => refresh(), 5000);
  const { data: riskData } = useRiskWarningsCtx();
  const unifiedRisk = useThunderstormRisk();

  if (weatherErrorCode === "unsupported_location") {
    return <UnsupportedLocationNotice />;
  }

  if (!weather) {
    return <WeatherLoader city={location.name} />;
  }

  const copy = ERROR_COPY[(errorCode ?? "UNKNOWN") as SynoptikErrorCode];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Brain className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Synoptische KI-Analyse für{" "}
          <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>

      {/* Amtliche Warnungen */}
      <OfficialWarningsSection />

      {/* RiskHero — Gewitter-Score */}
      {riskData && (
        <RiskHero risk={{ ...riskData.gewitter_risiko_6h, score: unifiedRisk.current.score }} />
      )}

      {/* KI-Auswertung · 12 h */}
      {riskData && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                KI-Auswertung · 12 h
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                Synoptische KI-Risikoeinschätzung – nicht amtlich
              </p>
            </div>
            {riskData.warnungen_12h.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {riskData.warnungen_12h.length}{" "}
                {riskData.warnungen_12h.length === 1 ? "Warnung" : "Warnungen"}
              </span>
            )}
          </div>
          {riskData.warnungen_12h.length > 0 ? (
            <div className="space-y-3">
              {riskData.warnungen_12h.map((w, i) => (
                <WarningCard key={`${w.id}_${i}`} warning={w} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2} />
              <p className="text-sm text-muted-foreground">
                Die KI-Auswertung sieht aktuell keine kritischen Risiken.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Initial loading */}
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
            Erneut versuchen
          </button>
        </div>
      )}

      {data && (
        <div className={`relative space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* KI-Analyse Hero */}
          <HeroCard
            highlight={formatHighlight(data.highlight?.text ?? "")}
            confidenceScore={data.confidence?.score ?? 0}
            confidenceReason={data.confidence?.begründung}
          />

          {/* Großwetterlage */}
          <SectionCard
            icon={Globe}
            title="Großwetterlage"
            subtitle={data.großwetterlage?.klassifikation}
          >
            {data.großwetterlage?.beschreibung}
          </SectionCard>

          {/* Aktuelle Lage */}
          {data.aktuell && (
            <SectionCard icon={Wind} title="Aktuelle Lage">
              <p>{data.aktuell.lage}</p>
              {data.aktuell.luftmasse && (
                <p className="mt-2 text-sm text-muted-foreground">{data.aktuell.luftmasse}</p>
              )}
            </SectionCard>
          )}

          {/* Gewitterrisiko & Konvektion */}
          <SectionCard icon={Zap} title="Gewitterrisiko & Konvektion">
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

          {/* Entwicklung */}
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

          {/* Regionale Besonderheiten */}
          {data.regionale_besonderheiten && data.regionale_besonderheiten.length > 0 && (
            <SectionCard icon={MapPin} title="Regionale Besonderheiten">
              <ul className="list-disc space-y-1 pl-5">
                {data.regionale_besonderheiten.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </SectionCard>
          )}

          {/* Details für Wetter-Nerds */}
          {data.großwetterlage_detail && (
            <SectionCard icon={Layers} title="Details für Wetter-Nerds">
              <div className="space-y-2">
                {data.großwetterlage_detail.höhenstruktur && (
                  <p><span className="font-medium">Höhenstruktur: </span>{data.großwetterlage_detail.höhenstruktur}</p>
                )}
                {data.großwetterlage_detail.bodendruck && (
                  <p><span className="font-medium">Bodendruck: </span>{data.großwetterlage_detail.bodendruck}</p>
                )}
                {data.großwetterlage_detail.fronten && (
                  <p><span className="font-medium">Fronten: </span>{data.großwetterlage_detail.fronten}</p>
                )}
              </div>
            </SectionCard>
          )}

          <AnalysisDisclaimer />

          {data.stale && (
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <StaleBadge ageMinutes={data.ageMinutes} />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
            <div className="italic">
              {(() => {
                const ageMin = typeof data.ageMinutes === "number" ? data.ageMinutes : null;
                const originTs = ageMin != null ? Date.now() - ageMin * 60000 : lastUpdated;
                if (!originTs) return "—";
                const label = `Letzte Analyse: ${relMin(originTs)}`;
                const showFreshCacheHint = data.cached && ageMin != null && ageMin <= 30;
                return (
                  <>
                    {label}
                    {showFreshCacheHint && (
                      <span className="ml-2 not-italic">(aus Cache, max. 30 Min alt)</span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-center text-xs text-muted-foreground">
        Datenquelle: {getWeatherModelLabel(location.country_code)}
      </div>
    </div>
  );
}
