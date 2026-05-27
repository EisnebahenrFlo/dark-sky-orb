import { Star, MapPin, Plus } from "lucide-react";
import { useWeather } from "@/contexts/WeatherContext";
import { useFavorites } from "@/hooks/useFavorites";
import { geoToFavorite } from "@/lib/favoritesStorage";
import { haptic } from "@/lib/utils";
import { toast } from "sonner";

export function CurrentLocationCard({ onAdded }: { onAdded?: () => void }) {
  const { location } = useWeather();
  const { isFavorite, addFavorite, max } = useFavorites();
  const fav = geoToFavorite(location);
  const already = isFavorite(fav.id);

  const handleAdd = () => {
    const r = addFavorite(fav);
    if (r.ok) {
      haptic("medium");
      toast.success(`${fav.name} zu Favoriten hinzugefügt`, { duration: 2000 });
      onAdded?.();
    } else if (r.reason === "max") {
      toast.error(`Maximum von ${max} Favoriten erreicht`, {
        description: "Entferne erst einen Favoriten.",
      });
    }
  };

  return (
    <div>
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Aktueller Standort
      </div>
      <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3.5 border border-border/60">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <MapPin className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{location.name}</div>
            {(location.admin1 || location.country) && (
              <div className="truncate text-[11px] text-muted-foreground">
                {[location.admin1, location.country].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        {already ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <Star className="h-3 w-3 fill-current" /> Favorit
          </span>
        ) : (
          <button
            onClick={handleAdd}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 shadow-sm"
          >
            <Plus className="h-3 w-3" strokeWidth={3} /> Speichern
          </button>
        )}
      </div>
    </div>
  );
}
