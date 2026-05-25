import { useEffect, useState } from "react";
import { AlertCircle, ShieldAlert } from "lucide-react";
import { WarningsLoader } from "@/components/loaders/WarningsLoader";
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { useWeather } from "@/contexts/WeatherContext";
import { UnsupportedLocationNotice } from "@/components/PageState";
import { RiskHero } from "@/components/warnings/RiskHero";
import { WarningCard } from "@/components/warnings/WarningCard";
import { DisclaimerBanner } from "@/components/warnings/DisclaimerBanner";
import { colorClasses } from "@/components/warnings/colors";
import { scoreMeta } from "@/components/warnings/RiskHero";
import { WeatherLoader } from "@/components/loaders/WeatherLoader";
import { OfficialWarningsSection } from "@/components/warnings/OfficialWarningsSection";
import { StaleBadge } from "@/components/StaleBadge";
import type { RiskWarningsErrorCode } from "@/hooks/useRiskWarnings";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { PullToRefresh } from "@/components/PullToRefreshIndicator";

function relMin(ts: number) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return "gerade eben";
  if (m === 1) return "vor 1 Min";
  return `vor ${m} Min`;
}

const KI_ERROR_COPY: Record<RiskWarningsErrorCode, { title: string; body: string }> = {
  TIMEOUT: { title: "KI-Formulierung dauert ungewöhnlich lange", body: "Die KI-Auswertung antwortet gerade nicht. Bitte erneut versuchen." },
  RATE_LIMIT: { title: "KI-Dienste vorübergehend überlastet", body: "Das liegt an Anthropic, nicht an MeteoFlo. Bitte in ein paar Minuten erneut versuchen." },
  API_ERROR: { title: "KI-Dienste vorübergehend überlastet", body: "Das liegt an Anthropic, nicht an MeteoFlo. Bitte in ein paar Minuten erneut versuchen." },
  PARSE_ERROR: { title: "KI-Antwort unvollständig", body: "Die KI-Antwort konnte nicht ausgewertet werden." },
  INVALID_RESPONSE: { title: "KI-Antwort unvollständig", body: "Die KI-Antwort konnte nicht ausgewertet werden." },
  BAD_REQUEST: { title: "KI-Auswertung nicht möglich", body: "Für diesen Standort konnte keine KI-Auswertung erstellt werden." },
  NETWORK: { title: "Verbindungsproblem", body: "Verbindungsproblem. Bitte erneut versuchen." },
  UNKNOWN: { title: "Etwas ist schiefgelaufen", body: "Bitte erneut versuchen." },
};


export function WarnungenPage() {
  const { data: weather, location, errorCode } = useWeather();
  const { data, loading, error, errorCode: kiErrorCode, refresh, lastUpdated } = useRiskWarningsCtx();
  const { data: officialData } = useOfficialWarningsCtx();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 280);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (errorCode === "unsupported_location") return <UnsupportedLocationNotice />;
  if (!weather) return <WeatherLoader city={location.name} />;

  const stickyMeta = data ? scoreMeta(data.gewitter_risiko_6h.score) : null;
  const stickyColor = stickyMeta ? colorClasses[stickyMeta.color] : null;
  const kiCopy = KI_ERROR_COPY[kiErrorCode ?? "UNKNOWN"];

  const official = officialData?.warnings ?? [];
  const officialMax = official.reduce((m, w) => Math.max(m, w.level ?? 1), 0);
  const officialLabel = officialMax >= 4 ? "Extrem" : officialMax === 3 ? "Unwetter" : officialMax === 2 ? "Markant" : "Hinweis";
  const weatherCode = (weather as any)?.current?.weather_code;
  const handleRefresh = () => refresh();

  const ki = data?.warnungen_12h ?? [];
  const hasActiveWarnings = official.length > 0 || ki.length > 0;

  if (!loading && !error && data && !hasActiveWarnings) {
    return (
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={loading} weatherCode={weatherCode}>
        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-accent" strokeWidth={1.75} />
            <span>
              Warnungen für <span className="font-medium text-foreground">{location.name}</span>
            </span>
          </div>
          <div
            className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 dark:bg-card"
            style={{ marginBottom: "6px" }}
          >
            <svg width="36" height="36" viewBox="0 0 52 52" aria-hidden>
              <defs>
                <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#16a34a" />
                </linearGradient>
              </defs>
              <path
                d="M26 6 L42 12.5 L42 26 C42 36 35 43.5 26 46.5 C17 43.5 10 36 10 26 L10 12.5 Z"
                fill="none"
                stroke="url(#shieldGrad)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <polyline
                points="18,26 23,31 34,20"
                fill="none"
                stroke="url(#shieldGrad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <div className="text-xs font-bold text-[#1a2a3a] dark:text-foreground">
                Alles ruhig
              </div>
              <div className="mt-px text-[9.5px] leading-snug text-[#8a9ab0] dark:text-muted-foreground">
                Keine aktiven Warnungen · Die nächsten 48h bleiben warnungsfrei
              </div>
            </div>
          </div>
        </div>
      </PullToRefresh>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} isRefreshing={loading} weatherCode={weatherCode}>
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Warnungen für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>





      {/* Sticky compact risk indicator */}
      {data && stickyColor && scrolled && (
        <div className="sticky top-2 z-20 -mx-1">
          <div className={`glass flex items-center justify-between gap-3 rounded-full border ${stickyColor.border} bg-background/80 px-4 py-2 shadow-lg backdrop-blur`}>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Gewitter-Risiko 6h:</span>
              <span className={`font-display text-base font-semibold ${stickyColor.text}`}>{data.gewitter_risiko_6h.score}</span>
              <span className={`rounded-full ${stickyColor.bg} ${stickyColor.text} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider`}>
                {stickyMeta!.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* RiskHero requires data; render only when available */}
      {data && <RiskHero risk={data.gewitter_risiko_6h} />}

      {/* SEKTION 1: Amtliche Warnungen — IMMER sichtbar, unabhängig vom KI-Status */}
      <OfficialWarningsSection />

      {/* SEKTION 2: KI-Auswertung — eigener Error-State, blockiert nichts anderes */}
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
          {data && data.warnungen_12h.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {data.warnungen_12h.length} {data.warnungen_12h.length === 1 ? "Warnung" : "Warnungen"}
            </span>
          )}
        </div>

        {loading && !data && <WarningsLoader />}

        {error && !data && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="h-6 w-6 text-foreground/70" strokeWidth={1.75} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-foreground">{kiCopy.title}</h3>
              <p className="text-sm text-muted-foreground">{kiCopy.body}</p>
            </div>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {data && (
          <div className={`relative space-y-3 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {data.warnungen_12h.map((w, i) => <WarningCard key={`${w.id}_${i}`} warning={w} />)}
            {data.stale && (
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <StaleBadge ageMinutes={data.ageMinutes} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Gesamt-Summary — basiert primär auf amtlichen, ergänzt um KI */}
      {(data || official.length > 0) && (() => {
        let summaryText: string;
        if (official.length > 0) {
          summaryText = `${official.length} aktive amtliche ${official.length === 1 ? "Warnung" : "Warnungen"} – höchste Stufe: ${officialLabel}.${ki.length > 0 ? ` Zusätzlich ${ki.length} KI-Hinweis${ki.length === 1 ? "" : "e"}.` : ""}`;
        } else if (ki.length > 0 && data?.summary) {
          summaryText = data.summary;
        } else {
          return null;
        }
        return (
          <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="font-display text-base italic leading-relaxed text-foreground/90 sm:text-lg">
              {summaryText}
            </p>
          </div>
        );
      })()}

      {data && (
        <DisclaimerBanner
          text={`${data.disclaimer}\n\nAmtliche Warnungen stammen direkt von DWD (Deutschland) und MeteoAlarm (AT/CH/IT). Bei abweichender Beurteilung haben offizielle Quellen Vorrang. Die KI-Auswertung ist experimentell und ergänzend.`}
        />
      )}

      {data && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
          <div className="italic">
            {lastUpdated ? `Letzte Prüfung: ${relMin(lastUpdated)}` : "—"}
            {data.cached && <span className="ml-2 not-italic">(aus Cache, max. 15 Min alt)</span>}
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
      )}
    </div>
    </PullToRefresh>
  );
}
