import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, MapPin, Clock, X, Navigation, AlertCircle, Star, Command } from "lucide-react";
import { searchCities, type GeoResult } from "@/lib/weather";
import { isPostalCode } from "@/utils/postalCode";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haptic } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";
import { geoToFavorite } from "@/lib/favoritesStorage";
import { toast } from "sonner";

interface Props {
  onSelect: (loc: GeoResult) => void;
  recent: GeoResult[];
  onClearRecent: () => void;
}

export function SearchBar({ onSelect, recent, onClearRecent }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isFavorite, addFavorite, removeFavorite, max } = useFavorites();

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
      setOpen(false);
    }
    if (gpsStatus !== "success") consumedRef.current = false;
  }, [gpsStatus, coords, cityName, countryCode, onSelect]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchCities(q);
        setResults(r);
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Global "/" or Cmd/Ctrl+K focuses the search input.
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

  const showRecent = !q.trim() && recent.length > 0;
  const list = q.trim() ? results : recent;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && list[activeIdx]) {
      e.preventDefault();
      select(list[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showShortcutHint = useMemo(() => typeof window !== "undefined" && !q && !open, [q, open]);

  return (
    <div ref={ref} className="relative w-full">
      <div
        className={`glass relative flex items-center gap-3 rounded-2xl px-4 py-3.5 sm:px-5 transition-all ${
          open ? "ring-2 ring-primary/30 shadow-lg" : "ring-1 ring-border/50"
        }`}
      >
        <Search
          className={`h-5 w-5 shrink-0 transition-colors ${open ? "text-primary" : "text-muted-foreground"}`}
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
          placeholder="Stadt oder Postleitzahl suchen…"
          className="flex-1 bg-transparent pr-24 text-base outline-none placeholder:text-muted-foreground/70"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            aria-label="Eingabe löschen"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showShortcutHint && (
          <kbd className="hidden md:inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        )}
        <button
          type="button"
          onClick={() => {
            haptic("light");
            requestLocation();
          }}
          disabled={gpsStatus === "loading"}
          aria-label="Aktuellen Standort verwenden"
          title="Aktuellen Standort verwenden"
          className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/20 disabled:opacity-60"
        >
          {gpsStatus === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Navigation className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>

      {gpsStatus === "error" && gpsError && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{gpsError}</span>
        </div>
      )}

      {open && (showRecent || q.trim().length >= 2 || (q.trim() && loading)) && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl">
          {showRecent && (
            <div className="flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> Zuletzt gesucht</span>
              <button
                onClick={onClearRecent}
                className="rounded-md px-1.5 py-0.5 hover:bg-foreground/10 hover:text-foreground transition-colors"
              >
                leeren
              </button>
            </div>
          )}
          <ul className="max-h-96 overflow-auto py-1">
            {list.map((r, idx) => {
              const fav = geoToFavorite({
                ...r,
                admin1: r.admin1 ?? "",
                country: r.country ?? "",
                country_code: r.country_code ?? "",
              });
              const starred = isFavorite(fav.id);
              const isActive = idx === activeIdx;
              return (
                <li key={`${r.id}-${r.latitude}`}>
                  <div
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`group flex w-full items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-colors ${
                      isActive ? "bg-primary/10" : "hover:bg-foreground/5"
                    }`}
                  >
                    <button
                      onClick={() => select(r)}
                      className="flex flex-1 min-w-0 items-center gap-3 text-left"
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
                        isActive ? "bg-primary/15 text-primary" : "bg-foreground/5 text-muted-foreground"
                      }`}>
                        <MapPin className="h-4 w-4" strokeWidth={2} />
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
                          {[r.admin1, r.country].filter(Boolean).join(", ")}
                        </div>
                      </div>
                      {r.country_code && (
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground/80 px-1.5 py-0.5 rounded bg-foreground/5">
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
                      <Star
                        className={`h-4 w-4 ${starred ? "fill-amber-500" : ""}`}
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>
                </li>
              );
            })}
            {q.trim() && !loading && results.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                <Search className="mx-auto mb-2 h-5 w-5 opacity-40" />
                Keine Treffer in DACH/Italien.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
