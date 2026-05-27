import { useEffect, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ChevronDown,
  CloudFog,
  CloudLightning,
  CloudRain,
  Clock,
  Droplets,
  ExternalLink,
  MapPin,
  Mountain,
  Snowflake,
  Sun,
  Thermometer,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type {
  OfficialWarning,
  OfficialWarningLevel,
  OfficialWarningType,
} from "@/hooks/useOfficialWarnings";
import {
  formatRelativeStart,
  formatRemaining,
  getWarningTiming,
} from "@/lib/warningTime";

const ICON_MAP: Record<OfficialWarningType, LucideIcon> = {
  wind: Wind,
  rain: CloudRain,
  thunderstorm: CloudLightning,
  snow: Snowflake,
  ice: Droplets,
  glaze: Droplets,
  heat: Thermometer,
  cold: Thermometer,
  fog: CloudFog,
  flood: Waves,
  avalanche: Mountain,
  thaw: Droplets,
  snow_drift: Wind,
  extreme: AlertOctagon,
  uv: Sun,
  other: AlertTriangle,
};

type LevelTone = {
  label: string;
  strip: string;
  accent: string;
  tint: string;
  ring: string;
};

const LEVEL_TONE: Record<OfficialWarningLevel, LevelTone> = {
  1: {
    label: "Info",
    strip: "bg-emerald-500",
    accent: "text-emerald-600 dark:text-emerald-400",
    tint: "from-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  2: {
    label: "Markant",
    strip: "bg-amber-500",
    accent: "text-amber-600 dark:text-amber-400",
    tint: "from-amber-500/15",
    ring: "ring-amber-500/25",
  },
  3: {
    label: "Unwetter",
    strip: "bg-orange-500",
    accent: "text-orange-600 dark:text-orange-400",
    tint: "from-orange-500/15",
    ring: "ring-orange-500/30",
  },
  4: {
    label: "Extrem",
    strip: "bg-red-500",
    accent: "text-red-600 dark:text-red-400",
    tint: "from-red-500/20",
    ring: "ring-red-500/40",
  },
};

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const pad = (n: number) => n.toString().padStart(2, "0");
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dm = (d: Date) => `${pad(d.getDate())}. ${MONTHS[d.getMonth()]}`;

function formatFullRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) return `${dm(s)} · ${hm(s)} – ${hm(e)}`;
  return `${dm(s)}, ${hm(s)} – ${dm(e)}, ${hm(e)}`;
}

const TRUNCATE_AT = 140;

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function OfficialWarningCard({
  warning,
  variant = "auto",
}: {
  warning: OfficialWarning;
  variant?: "auto" | "hero" | "compact";
}) {
  const [expanded, setExpanded] = useState(false);
  const [areasExpanded, setAreasExpanded] = useState(false);
  const now = useNow();
  const Icon = ICON_MAP[warning.type] ?? AlertTriangle;
  const tone = LEVEL_TONE[warning.level] ?? LEVEL_TONE[2];
  const timing = getWarningTiming(warning.start, warning.end, now);
  const isHero = variant === "hero" || (variant === "auto" && timing.state === "active");

  const longDesc = warning.description && warning.description.length > TRUNCATE_AT;
  const desc =
    !longDesc || expanded
      ? warning.description
      : warning.description.slice(0, TRUNCATE_AT).trimEnd() + "…";

  const countdown =
    timing.state === "active"
      ? { label: "Endet", value: formatRemaining(timing.msUntilEnd), pulse: true }
      : timing.state === "upcoming"
        ? { label: "Beginnt", value: formatRelativeStart(timing.msUntilStart), pulse: false }
        : { label: "Beendet", value: "—", pulse: false };

  if (!isHero) {
    // Compact timeline row
    const start = new Date(warning.start);
    return (
      <div
        className={`relative flex items-stretch gap-3 overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm transition-colors hover:bg-card`}
      >
        <div className={`w-1 shrink-0 ${tone.strip}`} aria-hidden />
        <div className="flex flex-1 items-center gap-3 py-3 pr-3">
          <div className="flex min-w-[52px] flex-col items-center">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {dm(start)}
            </span>
            <span className="font-display text-sm font-bold text-foreground">{hm(start)}</span>
          </div>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted/50 text-foreground/80">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-bold uppercase tracking-wider ${tone.accent}`}>
                {tone.label}
              </span>
              <span className="text-[10px] text-muted-foreground/70">· {countdown.value}</span>
            </div>
            <h4 className="truncate text-sm font-semibold text-foreground">{warning.title}</h4>
          </div>
          {warning.url && (
            <a
              href={warning.url}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Details öffnen"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // Hero card (active warning)
  return (
    <div
      className={`relative animate-fade-in overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm`}
    >
      {/* gradient tint */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.tint} via-transparent to-transparent`}
        aria-hidden
      />
      {/* severity strip */}
      <div className={`absolute left-0 top-0 h-full w-1.5 ${tone.strip}`} aria-hidden />

      <div className="relative p-4 pl-5 sm:p-5 sm:pl-6">
        {/* Top row: source + countdown */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-2 w-2 ${countdown.pulse ? "animate-pulse" : ""}`}>
              <span className={`inline-flex h-full w-full rounded-full ${tone.strip}`} />
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${tone.accent}`}>
              {tone.label} · {warning.source}
            </span>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {countdown.label}
            </div>
            <div className={`font-display text-sm font-bold tabular-nums ${tone.accent}`}>
              {countdown.value}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background/70 ring-1 ${tone.ring}`}>
            <Icon className={`h-5 w-5 ${tone.accent}`} strokeWidth={2} />
          </div>
          <h3 className="font-display text-base font-bold leading-tight text-foreground sm:text-lg">
            {warning.title}
          </h3>
        </div>

        {/* Description */}
        {warning.description && (
          <div className="mt-3">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {desc}
            </p>
            {longDesc && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                {expanded ? "Weniger" : "Mehr lesen"}
                <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="font-medium text-foreground/80">
              {formatFullRange(warning.start, warning.end)}
            </span>
          </span>
          {warning.areas && warning.areas.length > 0 && (
            <span className="inline-flex max-w-full items-start gap-1.5 text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="font-medium text-foreground/80">{warning.areas[0]}</span>
                {warning.areas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setAreasExpanded((v) => !v)}
                    className="ml-1.5 text-[11px] font-medium text-accent hover:underline"
                  >
                    {areasExpanded
                      ? "weniger"
                      : `+${warning.areas.length - 1} weitere`}
                  </button>
                )}
                {areasExpanded && warning.areas.length > 1 && (
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground/80">
                    {warning.areas.slice(1).join(" · ")}
                  </span>
                )}
              </span>
            </span>
          )}
        </div>

        {warning.url && (
          <div className="mt-3 flex justify-end">
            <a
              href={warning.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Quelle öffnen <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
