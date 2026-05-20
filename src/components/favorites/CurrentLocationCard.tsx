import { Star, MapPin } from "lucide-react";
import { useWeather } from "@/contexts/WeatherContext";
import { useFavorites } from "@/hooks/useFavorites";
import { geoToFavorite } from "@/lib/favoritesStorage";
import { toast } from "sonner";

export function CurrentLocationCard({ onAdded }: { onAdded?: () => void }) {
  const { location } = useWeather();
  const { isFavorite, addFavorite, max } = useFavorites();
  const fav = geoToFavorite(location);
  const already = isFavorite(fav.id);

  const handleAdd = () => {
    const r = addFavorite(fav);
    if (r.ok) {
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
      <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Aktueller Standort
      </div>
      <div className="glass flex items-center justify-between gap-3 rounded-xl p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MapPin className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{location.name}</div>
            {(location.admin1 || location.country) && (
              <div className="truncate text-[11px] text-muted-foreground">
                {[location.admin1, location.country].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
        {already ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Star className="h-3 w-3 fill-accent text-accent" /> Bereits Favorit
          </span>
        ) : (
          <button
            onClick={handleAdd}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Star className="h-3 w-3" /> Favorit
          </button>
        )}
      </div>
    </div>
  );
}
