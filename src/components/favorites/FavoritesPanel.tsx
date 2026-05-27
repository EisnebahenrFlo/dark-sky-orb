import { useMemo, useState } from "react";
import { Star, Pencil, Check, Sparkles } from "lucide-react";
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
  const { favorites, removeFavorite, moveFavoriteUp, moveFavoriteDown, max } = useFavorites();
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
        className={`flex flex-col gap-0 bg-background ${
          isMobile ? "max-h-[88vh] rounded-t-3xl" : "w-full sm:max-w-md"
        }`}
      >
        {isMobile && (
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
        )}
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2.5 text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/15 text-amber-500">
              <Star className="h-4 w-4 fill-current" strokeWidth={1.5} />
            </span>
            <span>Favoriten</span>
            <span className="text-xs font-normal text-muted-foreground">
              {favorites.length}/{max}
            </span>
          </SheetTitle>
          {favorites.length > 0 && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                editMode
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
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
            <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Meine Orte</span>
              {favorites.length > 0 && (
                <span className="font-mono normal-case tracking-normal">
                  Tippen zum Wechseln
                </span>
              )}
            </div>

            {favorites.length === 0 ? (
              <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center border border-dashed border-border">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-500/10 text-amber-500">
                  <Sparkles className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Noch keine Favoriten</p>
                  <p className="text-xs text-muted-foreground">
                    Tippe oben auf <Star className="inline h-3 w-3 align-middle" /> oder nutze die Suche, um Orte zu speichern.
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass overflow-hidden rounded-2xl border border-border/60 p-1">
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
