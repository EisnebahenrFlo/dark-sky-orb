import { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CloudFog,
  CloudLightning,
  CloudRain,
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

const LEVEL_STYLE: Record<
  OfficialWarningLevel,
  { border: string; bg: string; text: string; iconBg: string; label: string }
> = {
  1: {
    border: "border-l-green-500",
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "Info",
  },
  2: {
    border: "border-l-yellow-500",
    bg: "bg-yellow-500/15",
    text: "text-yellow-700 dark:text-yellow-300",
    iconBg: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    label: "Markant",
  },
  3: {
    border: "border-l-orange-500",
    bg: "bg-orange-500/15",
    text: "text-orange-700 dark:text-orange-300",
    iconBg: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
    label: "Unwetter",
  },
  4: {
    border: "border-l-red-500",
    bg: "bg-red-500/15",
    text: "text-red-700 dark:text-red-300",
    iconBg: "bg-red-500/15 text-red-700 dark:text-red-300",
    label: "Extrem",
  },
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dm = (d: Date) => `${pad(d.getDate())}. ${MONTHS[d.getMonth()]}`;
  if (sameDay) return `${hm(s)} – ${hm(e)}`;
  return `${dm(s)}, ${hm(s)} – ${dm(e)}, ${hm(e)}`;
}

const TRUNCATE_AT = 150;

export function OfficialWarningCard({ warning }: { warning: OfficialWarning }) {
  const [expanded, setExpanded] = useState(false);
  const [areasExpanded, setAreasExpanded] = useState(false);
  const Icon = ICON_MAP[warning.type] ?? AlertTriangle;
  const level = (LEVEL_STYLE[warning.level] ?? LEVEL_STYLE[2]);
  const longDesc = warning.description && warning.description.length > TRUNCATE_AT;
  const desc = !longDesc || expanded
    ? warning.description
    : warning.description.slice(0, TRUNCATE_AT).trimEnd() + "…";

  return (
    <div
      className={`relative animate-fade-in overflow-hidden rounded-2xl border-y border-r border-border border-l-4 ${level.border} bg-card p-5 shadow-sm transition-colors hover:border-foreground/20 sm:p-6`}
    >
      <div className="flex items-start gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${level.iconBg}`}>
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {warning.title}
            </h3>
            <span
              className={`shrink-0 rounded-full ${level.bg} ${level.text} px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider`}
            >
              {level.label}
            </span>
          </div>
          {warning.description && (
            <>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                {desc}
              </p>
              {longDesc && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 text-xs font-medium text-accent hover:underline"
                >
                  {expanded ? "Weniger anzeigen ↑" : "Mehr lesen ↓"}
                </button>
              )}
            </>
          )}

          <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {warning.areas && warning.areas.length > 0 && (
              <span className="inline-flex max-w-full items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="truncate">{warning.areas[0]}</span>
                  {warning.areas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAreasExpanded((v) => !v)}
                      className="ml-1.5 text-[11px] font-medium text-accent hover:underline"
                    >
                      {areasExpanded ? "weniger ↑" : `+ ${warning.areas.length - 1} weitere ${warning.areas.length - 1 === 1 ? "Region" : "Regionen"} ↓`}
                    </button>
                  )}
                  {areasExpanded && warning.areas.length > 1 && (
                    <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground/90">
                      {warning.areas.slice(1).join(" · ")}
                    </span>
                  )}
                </span>
              </span>
            )}
            {warning.start && warning.end && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>⏰</span>
                <span>{formatRange(warning.start, warning.end)}</span>
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground">
              Quelle: {warning.source}
            </span>
            {warning.url && (
              <a
                href={warning.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                Details <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
