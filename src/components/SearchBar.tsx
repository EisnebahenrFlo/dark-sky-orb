import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, MapPin, Clock, X, Navigation, AlertCircle, Star, Command } from "lucide-react";
import { searchCities, type GeoResult } from "@/lib/weather";
import { isPostalCode } from "@/utils/postalCode";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haptic } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";
import { geoToFavorite, favoriteToGeo } from "@/lib/favoritesStorage";
import { toast } from "sonner";

interface Props {
  onSelect: (loc: GeoResult) => void;
  recent: GeoResult[];
  onClearRecent: () => void;
}

type Section = { kind: "fav" | "recent" | "result"; item: GeoResult };

export function SearchBar({ onSelect, recent, onClearRecent }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { favorites, isFavorite, addFavorite, removeFavorite, max } = useFavorites();

  const {
    status: gpsStatus,
    coords,
    cityName,
    countryCode,
    error: gpsError,
    requestLocation,
  } = useGeolocation();

  const consumedRef = useRef(false);
  useEffect(() => {
    if (gpsStatus === "success" && coords && cityName && !consumedRef.current) {
      consumedRef.current = true;
      onSelect({
        id: Math.floor(coords.latitude * 1e4) * 1000 + Math.floor(coords.longitude * 1e4),
        name: cityName,
        latitude: coords.latitude,
        longitude: coords.longitude,
        country: "",
        country_code: countryCode || "",
      });
      toast.success(`Standort: ${cityName} übernommen`, { duration: 1800 });
      setOpen(false);
    }
    if (gpsStatus !== "success") consumedRef.current = false;
  }, [gpsStatus, coords, cityName, countryCode, onSelect]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchCities(q);
        setResults(r);
        setActiveIdx(0);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (isTyping) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const select = (r: GeoResult) => {
    haptic("light");
    onSelect(r);
    setQ("");
    setOpen(false);
  };

  const toggleFavorite = (e: React.MouseEvent, r: GeoResult) => {
    e.stopPropagation();
    const fav = geoToFavorite({
      ...r,
      admin1: r.admin1 ?? "",
      country: r.country ?? "",
      country_code: r.country_code ?? "",
    });
    if (isFavorite(fav.id)) {
      removeFavorite(fav.id);
      haptic("light");
      toast(`${fav.name} aus Favoriten entfernt`, { duration: 1600 });
    } else {
      const res = addFavorite(fav);
      if (res.ok) {
        haptic("medium");
        toast.success(`${fav.name} zu Favoriten`, { duration: 1600 });
      } else if (res.reason === "max") {
        toast.error(`Maximum von ${max} Favoriten erreicht`);
      }
    }
  };

  const sections: Section[] = useMemo(() => {
    if (q.trim()) return results.map((item) => ({ kind: "result" as const, item }));
    const favGeo: Section[] = favorites.map((f) => ({ kind: "fav" as const, item: favoriteToGeo(f) }));
    const recGeo: Section[] = recent
      .slice(0, 6)
      .filter((r) => !favorites.some((f) => f.id === `${r.latitude.toFixed(4)}_${r.longitude.toFixed(4)}`))
      .map((item) => ({ kind: "recent" as const, item }));
    return [...favGeo, ...recGeo];
  }, [q, results, favorites, recent]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, sections.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && sections[activeIdx]) {
      e.preventDefault();
      select(sections[activeIdx].item);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showShortcutHint = useMemo(() => typeof window !== "undefined" && !q && !open, [q, open]);

  const favSection = sections.filter((s) => s.kind === "fav");
  const recSection = sections.filter((s) => s.kind === "recent");
  const resSection = sections.filter((s) => s.kind === "result");

  const renderItem = (s: Section, globalIdx: number) => {
    const r = s.item;
    const fav = geoToFavorite({
      ...r,
      admin1: r.admin1 ?? "",
      country: r.country ?? "",
      country_code: r.country_code ?? "",
    });
    const starred = isFavorite(fav.id);
    const isActive = globalIdx === activeIdx;
    const Icon = s.kind === "fav" ? Star : s.kind === "recent" ? Clock : MapPin;
    return (
      <li key={`${s.kind}-${r.latitude.toFixed(4)}-${r.longitude.toFixed(4)}`}>
        <div
          onMouseEnter={() => setActiveIdx(globalIdx)}
          className={`group mx-1 flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
            isActive ? "bg-primary/10" : "hover:bg-foreground/5"
          }`}
        >
          <button
            onClick={() => select(r)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                isActive ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted-foreground"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${s.kind === "fav" && starred ? "fill-amber-500 text-amber-500" : ""}`}
                strokeWidth={2}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{r.name}</span>
                {isPostalCode(q) && r.postcodes?.[0] && (
                  <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    PLZ
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.postcodes?.[0] && `${r.postcodes[0]} · `}
                {[r.admin1, r.admin2, r.country].filter(Boolean).slice(0, 2).join(", ")}
              </div>
            </div>
            {r.country_code && (
              <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground/80">
                {r.country_code}
              </span>
            )}
          </button>
          <button
            onClick={(e) => toggleFavorite(e, r)}
            aria-label={starred ? "Favorit entfernen" : "Zu Favoriten hinzufügen"}
            title={starred ? "Favorit entfernen" : "Zu Favoriten hinzufügen"}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all ${
              starred
                ? "text-amber-500 hover:bg-amber-500/10"
                : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-foreground/10 hover:text-foreground"
            }`}
          >
            <Star className={`h-4 w-4 ${starred ? "fill-amber-500" : ""}`} strokeWidth={1.75} />
          </button>
        </div>
      </li>
    );
  };

  const showEmptyStateHint = !q.trim() && sections.length === 0;
  const showNoResults = !!q.trim() && !loading && results.length === 0;

  return (
    <div ref={ref} className="relative w-full">
      <div
        className={`glass relative flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all sm:px-4 ${
          open ? "shadow-lg ring-2 ring-primary/40" : "ring-1 ring-border/50"
        }`}
      >
        <Search
          className={`h-4 w-4 shrink-0 transition-colors ${open ? "text-primary" : "text-muted-foreground"}`}
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          inputMode="search"
          aria-label="Ort oder Postleitzahl suchen"
          placeholder="Ort oder PLZ suchen…"
          disabled={gpsStatus === "loading"}
          className="min-w-0 flex-1 bg-transparent pr-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />

        <div className="flex shrink-0 items-center gap-1.5">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {q && !loading && (
            <button
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              aria-label="Eingabe löschen"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {showShortcutHint && (
            <kbd className="hidden items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
              <Command className="h-3 w-3" />K
            </kbd>
          )}
          <span className="mx-0.5 hidden h-5 w-px bg-border/60 sm:block" />
          <button
            type="button"
            onClick={() => {
              haptic("light");
              requestLocation();
            }}
            disabled={gpsStatus === "loading"}
            aria-label="Aktuellen Standort verwenden"
            title="Aktuellen Standort verwenden"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20 disabled:opacity-60"
          >
            {gpsStatus === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Navigation className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {gpsStatus === "error" && gpsError && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <div className="flex-1">
            <div>{gpsError}</div>
            <div className="mt-0.5 text-xs opacity-80">
              Standortzugriff in den Browser-Einstellungen aktivieren und Seite neu laden.
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute inset-x-0 z-20 mt-2 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl">
          {q.trim() ? (
            <>
              {loading && (
                <ul className="py-1">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="mx-1 flex items-center gap-3 rounded-xl px-3 py-2.5">
                      <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-foreground/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-1/2 animate-pulse rounded bg-foreground/10" />
                        <div className="h-2.5 w-1/3 animate-pulse rounded bg-foreground/5" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!loading && resSection.length > 0 && (
                <ul className="max-h-96 overflow-auto py-1">
                  {resSection.map((s, i) => renderItem(s, i))}
                </ul>
              )}
              {showNoResults && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  <Search className="mx-auto mb-2 h-5 w-5 opacity-40" />
                  Keine Treffer in DACH/Italien.
                  <div className="mt-1 text-xs opacity-75">
                    Versuche eine PLZ (z.B. 90402) oder die korrekte Schreibweise.
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {favSection.length > 0 && (
                <div>
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Favoriten
                    </span>
                    <span className="opacity-70">
                      {favorites.length}/{max}
                    </span>
                  </div>
                  <ul className="py-1">{favSection.map((s, i) => renderItem(s, i))}</ul>
                </div>
              )}

              {recSection.length > 0 && (
                <div>
                  <div className="flex items-center justify-between border-b border-t border-border/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Zuletzt gesucht
                    </span>
                    <button
                      onClick={onClearRecent}
                      className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    >
                      leeren
                    </button>
                  </div>
                  <ul className="max-h-72 overflow-auto py-1">
                    {recSection.map((s, i) => renderItem(s, favSection.length + i))}
                  </ul>
                </div>
              )}

              {showEmptyStateHint && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  <Search className="mx-auto mb-2 h-5 w-5 opacity-40" />
                  Ort oder PLZ eingeben
                  <div className="mt-1 text-xs opacity-75">
                    DACH &amp; Italien · z.B. „Nürnberg" oder „90402"
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
