import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Sun,
  CloudRain,
  Clock,
  CalendarDays,
  Map,
  Brain,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FavoritesButton } from "@/components/favorites/FavoritesButton";
import { useWeather } from "@/contexts/WeatherContext";
import { useRiskWarningsCtx } from "@/contexts/RiskWarningsContext";
import { useOfficialWarningsCtx } from "@/contexts/OfficialWarningsContext";
import { APP_VERSION } from "@/lib/constants";
import { isDevEnvironment } from "@/lib/environment";
import { WeatherTabTransition } from "@/components/transitions/WeatherTabTransition";

const TABS = [
  { to: "/", icon: Sun, label: "Aktuell" },
  { to: "/nowcast", icon: CloudRain, label: "Nowcast" },
  { to: "/hourly", icon: Clock, label: "Stündlich" },
  { to: "/daily", icon: CalendarDays, label: "7 Tage" },
  { to: "/analyse", icon: Brain, label: "Analyse" },
  { to: "/warnungen", icon: AlertTriangle, label: "Warnungen" },
  { to: "/map", icon: Map, label: "Karte" },
] as const;

export function AppShell() {
  const { selectLocation, recent, clearRecent, isFetching, refresh } = useWeather();
  const { data: riskData } = useRiskWarningsCtx();
  const { data: officialData } = useOfficialWarningsCtx();
  const warnCount =
    (riskData?.warnungen_12h?.length ?? 0) + (officialData?.warnings?.length ?? 0);
  let maxLevel = 0;
  for (const w of riskData?.warnungen_12h ?? []) {
    const r = w.stufe === "extrem" ? 4 : w.stufe === "unwetter" ? 3 : w.stufe === "markant" ? 2 : 1;
    if (r > maxLevel) maxLevel = r;
  }
  for (const w of officialData?.warnings ?? []) {
    if ((w.level ?? 1) > maxLevel) maxLevel = w.level ?? 1;
  }
  const badgeColor =
    maxLevel >= 4 ? "bg-red-500" : maxLevel === 3 ? "bg-orange-500" : maxLevel === 2 ? "bg-yellow-500" : "bg-blue-500";
  const badgePulse = maxLevel >= 3 ? "animate-pulse" : "";
  const { pathname } = useLocation();

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-28 pt-6 transition-colors duration-200 sm:px-6 sm:pb-12 sm:pt-10">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          <span className="font-display text-sm uppercase tracking-[0.3em] text-muted-foreground">
            MeteoFlo
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <FavoritesButton />
          <ThemeToggle />
          <button
            onClick={() => refresh()}
            disabled={isFetching}
            aria-label="Aktualisieren"
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="mb-6">
        <SearchBar onSelect={selectLocation} recent={recent} onClearRecent={clearRecent} />
      </div>

      {/* Desktop tabs */}
      <nav className="mb-8 hidden justify-center md:flex">
        <div className="glass flex gap-1 rounded-full p-1">
          {TABS.map(({ to, icon: Icon, label }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors ${
                  active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 -z-0 rounded-full bg-primary" aria-hidden />
                )}
                <span className="relative z-10 inline-flex">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {to === "/warnungen" && warnCount > 0 && (
                    <span className={`absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full ${badgeColor} ${badgePulse} px-1 text-[9px] font-bold text-white shadow ring-2 ring-background`}>
                      {warnCount}
                    </span>
                  )}
                </span>
                <span className="relative z-10 font-medium">{label}</span>
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
      <nav className="fixed inset-x-0 bottom-0 z-30 md:hidden">
        <div className="mx-auto max-w-md px-3 pb-3">
          <div className="glass flex items-center justify-around rounded-2xl p-1.5 shadow-2xl">
            {TABS.map(({ to, icon: Icon, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  title={label}
                  className={`flex flex-1 items-center justify-center rounded-xl py-3 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="relative inline-flex">
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                    {to === "/warnungen" && warnCount > 0 && (
                      <span className={`absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full ${badgeColor} ${badgePulse} px-1 text-[9px] font-bold text-white shadow ring-2 ring-background`}>
                        {warnCount}
                      </span>
                    )}
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
        <span className="rounded border border-orange-500/20 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold text-orange-500">
          DEV BUILD
        </span>
      </div>
      </footer>
    </div>
  );
}
