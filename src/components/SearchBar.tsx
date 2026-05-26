import { useEffect, useRef, useState } from "react";
import { Search, Loader2, MapPin, Clock, X, Navigation, AlertCircle } from "lucide-react";
import { searchCities, type GeoResult } from "@/lib/weather";
import { isPostalCode } from "@/utils/postalCode";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haptic } from "@/lib/utils";

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
  const ref = useRef<HTMLDivElement>(null);

  const {
    status: gpsStatus,
    coords,
    cityName,
    countryCode,
    error: gpsError,
    requestLocation,
  } = useGeolocation();

  // When GPS resolves, feed it into the same onSelect pipeline.
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

  const select = (r: GeoResult) => {
    onSelect(r);
    setQ("");
    setOpen(false);
  };

  const showRecent = !q.trim() && recent.length > 0;
  const list = q.trim() ? results : recent;

  return (
    <div ref={ref} className="relative w-full">
      <div className="glass relative flex items-center gap-3 rounded-2xl px-4 py-4 sm:px-5">
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          inputMode="search"
          placeholder="Stadt oder Postleitzahl…"
          className="flex-1 bg-transparent pr-24 text-base outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {q && !loading && (
          <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
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
          className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 shrink-0 place-items-center rounded-full text-primary transition hover:bg-primary/10 disabled:opacity-60"
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

      {open && (showRecent || q.trim().length >= 2) && (
        <div className="glass absolute z-20 mt-2 w-full overflow-hidden rounded-2xl shadow-2xl">
          {showRecent && (
            <div className="flex items-center justify-between px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-2"><Clock className="h-3 w-3" /> Zuletzt</span>
              <button onClick={onClearRecent} className="hover:text-foreground">leeren</button>
            </div>
          )}
          <ul className="max-h-80 overflow-auto">
            {list.map((r) => (
              <li key={`${r.id}-${r.latitude}`}>
                <button
                  onClick={() => select(r)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/5"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{r.name}</span>
                      {isPostalCode(q) && (
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          PLZ
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.postcodes?.[0] && `${r.postcodes[0]} · `}
                      {[r.admin1, r.country].filter(Boolean).join(", ")}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{r.country_code}</span>
                </button>
              </li>
            ))}
            {q.trim() && !loading && results.length === 0 && (
              <li className="px-5 py-4 text-sm text-muted-foreground">Keine Treffer in DACH/Italien.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
