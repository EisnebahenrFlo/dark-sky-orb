import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Sun,
  Calendar,
  Map,
  Loader2,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FavoritesButton } from "@/components/favorites/FavoritesButton";
import { useWeather } from "@/contexts/WeatherContext";
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { APP_VERSION } from "@/lib/constants";
import { isDevEnvironment } from "@/lib/environment";
import { haptic } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { WeatherTabTransition } from "@/components/transitions/WeatherTabTransition";

interface TabDef {
  to: "/" | "/vorhersage" | "/analyse" | "/map";
  icon: LucideIcon;
  label: string;
}

const STATIC_TABS: TabDef[] = [
  { to: "/", icon: Sun, label: "Heute" },
  { to: "/vorhersage", icon: Calendar, label: "Vorhersage" },
  { to: "/analyse", icon: HelpCircle, label: "Analyse" },
  { to: "/map", icon: Map, label: "Karte" },
];

export function AppShell() {
  const { selectLocation, recent, clearRecent, isFetching } = useWeather();
  const { data: riskData } = useRiskWarningsCtx();
  const { data: officialData } = useOfficialWarningsCtx();
  const { pathname } = useLocation();

  // Only DWD/MeteoAlarm count as "official". The OfficialWarnings hook already
  // restricts to those, but we filter defensively in case sources broaden.
  const officialWarningCount = (officialData?.warnings ?? []).filter(
    (w) => w.source === "DWD" || (typeof w.source === "string" && w.source.startsWith("MeteoAlarm")),
  ).length;
  const aiWarningCount = riskData?.warnungen_12h?.length ?? 0;

  // Analyse tab visual state — semantic "warning level" we map to tokens below.
  type WarnLevel = "none" | "ai" | "official" | "critical";
  let warnLevel: WarnLevel = "none";
  let analyseIcon: LucideIcon = HelpCircle;
  let analyseBadge: number | null = null;
  if (officialWarningCount >= 2) {
    warnLevel = "critical";
    analyseIcon = AlertTriangle;
    analyseBadge = officialWarningCount;
  } else if (officialWarningCount === 1) {
    warnLevel = "official";
    analyseIcon = AlertTriangle;
  } else if (aiWarningCount > 0) {
    warnLevel = "ai";
    analyseIcon = AlertTriangle;
  }

  // Warning styling — uses oklch tokens that adapt to light/dark via CSS variables.
  const warnStyles: Record<Exclude<WarnLevel, "none">, { bg: string; fg: string; ring: string }> = {
    critical: {
      bg: "bg-red-500 dark:bg-red-500",
      fg: "text-white",
      ring: "ring-red-500/30",
    },
    official: {
      bg: "bg-orange-500 dark:bg-orange-500",
      fg: "text-white",
      ring: "ring-orange-500/30",
    },
    ai: {
      bg: "bg-amber-500/90 dark:bg-amber-500/90",
      fg: "text-white",
      ring: "ring-amber-500/30",
    },
  };

  const tabs: TabDef[] = STATIC_TABS.map((t) =>
    t.to === "/analyse" ? { ...t, icon: analyseIcon } : t,
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+9rem)] pt-6 transition-colors duration-200 sm:px-6 sm:pb-12 sm:pt-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link to="/" aria-label="MeteoFlo Startseite" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
          <span className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">
            MeteoFlo
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {isFetching && (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-label="Daten werden aktualisiert"
              role="status"
            />
          )}
          <FavoritesButton />
          <ThemeToggle />
        </div>
      </header>


      <div className="mb-6">
        <SearchBar onSelect={selectLocation} recent={recent} onClearRecent={clearRecent} />
      </div>

      {/* Desktop tabs */}
      <nav aria-label="Hauptnavigation" className="mb-8 hidden justify-center md:flex">
        <div className="glass flex gap-1 rounded-full p-1">
          {tabs.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            const warn = to === "/analyse" && warnLevel !== "none" ? warnStyles[warnLevel] : null;
            const showBadge = to === "/analyse" && analyseBadge != null;
            const textCls = warn
              ? warn.fg
              : active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground";
            const bgCls = warn
              ? warn.bg
              : active
                ? "bg-primary"
                : "bg-transparent";
            return (
              <Link
                key={to}
                to={to}
                onClick={() => haptic("light")}
                className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${textCls}`}
              >
                <span
                  className={`absolute inset-0 -z-0 rounded-full transition-colors ${bgCls}`}
                  aria-hidden
                />
                <span className="relative z-10 inline-flex">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {showBadge && (
                    <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                      {analyseBadge}
                    </span>
                  )}
                </span>
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main>
        <WeatherTabTransition>
          <Outlet />
        </WeatherTabTransition>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-md px-3 pb-3 pt-2">
          <div className="glass flex items-stretch justify-around rounded-2xl p-1 shadow-2xl">
            {tabs.map(({ to, icon: Icon, label }) => {
              const active = pathname === to;
              const warn = to === "/analyse" && warnLevel !== "none" ? warnStyles[warnLevel] : null;
              const showBadge = to === "/analyse" && analyseBadge != null;

              const textCls = warn
                ? warn.fg
                : active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground";

              const pillCls = warn
                ? `${warn.bg} ring-1 ${warn.ring}`
                : active
                  ? "bg-primary/12 dark:bg-primary/18 ring-1 ring-primary/25"
                  : "bg-transparent";

              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => haptic("light")}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-all ${textCls}`}
                >
                  <span
                    className={`absolute inset-x-1 inset-y-0.5 -z-0 rounded-xl transition-all ${pillCls}`}
                    aria-hidden
                  />
                  <span className="relative z-10 inline-flex">
                    <Icon
                      className="h-[22px] w-[22px]"
                      strokeWidth={active || warn ? 2.25 : 1.75}
                    />
                    {showBadge && (
                      <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                        {analyseBadge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`relative z-10 text-[10px] leading-none tracking-tight ${
                      active || warn ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>



      <footer className="mt-12 space-y-1 text-center text-xs text-muted-foreground">
        <div>
          Daten von{" "}
          <a href="https://open-meteo.com" className="underline hover:text-foreground">
            Open-Meteo
          </a>
        </div>
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://github.com/EisnebahenrFlo/dark-sky-orb/blob/main/IMPRESSUM.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Impressum
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://github.com/EisnebahenrFlo/dark-sky-orb/blob/main/DATENSCHUTZ.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Datenschutz
          </a>
        </div>
        <div className="flex items-center justify-center gap-2">
          MeteoFlo v{APP_VERSION}
          {isDevEnvironment() && (
            <StatusBadge tone="warn" size="xs" uppercase>
              Dev
            </StatusBadge>
          )}

        </div>
      </footer>
    </div>
  );
}
