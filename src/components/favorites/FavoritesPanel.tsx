import { useMemo, useState } from "react";
import { Star, Pencil, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useWeather } from "@/contexts/WeatherContext";
import { useFavorites } from "@/hooks/useFavorites";
import { useFavoriteWeather } from "@/hooks/useFavoriteWeather";
import { favoriteIdFromGeo, favoriteToGeo } from "@/lib/favoritesStorage";
import { useIsMobile } from "@/hooks/use-mobile";
import { CurrentLocationCard } from "./CurrentLocationCard";
import { FavoriteItem } from "./FavoriteItem";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FavoritesPanel({ open, onOpenChange }: Props) {
  const { location, selectLocation } = useWeather();
  const { favorites, removeFavorite, moveFavoriteUp, moveFavoriteDown } = useFavorites();
  const [editMode, setEditMode] = useState(false);
  const isMobile = useIsMobile();

  const queryItems = useMemo(
    () => favorites.map((f) => ({ id: f.id, lat: f.lat, lon: f.lon })),
    [favorites],
  );
  const results = useFavoriteWeather(open ? queryItems : []);

  const activeId = favoriteIdFromGeo(location);

  const handleSelect = (favId: string) => {
    const fav = favorites.find((f) => f.id === favId);
    if (!fav) return;
    selectLocation(favoriteToGeo(fav));
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setEditMode(false);
      }}
    >
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`flex flex-col gap-0 ${
          isMobile ? "max-h-[85vh] rounded-t-2xl" : "w-full sm:max-w-md"
        }`}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-accent text-accent" strokeWidth={1.5} />
            Favoriten
          </SheetTitle>
          {favorites.length > 0 && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {editMode ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Fertig
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                </>
              )}
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-5 pr-1">
          <CurrentLocationCard onAdded={() => setEditMode(false)} />

          <div>
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Meine Orte {favorites.length > 0 && `(${favorites.length})`}</span>
            </div>

            {favorites.length === 0 ? (
              <div className="glass rounded-xl p-5 text-center text-sm text-muted-foreground">
                Noch keine Favoriten. Tippe oben auf{" "}
                <span className="font-medium text-foreground">Favorit</span>, um den
                aktuellen Standort hinzuzufügen.
              </div>
            ) : (
              <div className="glass divide-y divide-border rounded-xl overflow-hidden">
                {favorites.map((fav, i) => (
                  <FavoriteItem
                    key={fav.id}
                    favorite={fav}
                    weather={results[i]?.data}
                    loading={!!results[i]?.isLoading}
                    isActive={fav.id === activeId}
                    editMode={editMode}
                    isFirst={i === 0}
                    isLast={i === favorites.length - 1}
                    onSelect={() => handleSelect(fav.id)}
                    onDelete={() => removeFavorite(fav.id)}
                    onMoveUp={() => moveFavoriteUp(fav.id)}
                    onMoveDown={() => moveFavoriteDown(fav.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
