import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Loader2 } from "lucide-react";
import type { Favorite } from "@/lib/favoritesStorage";
import type { FavoriteCurrent } from "@/hooks/useFavoriteWeather";
import { EffectiveWeatherIcon } from "@/components/WeatherIcon";
import { haptic } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  favorite: Favorite;
  weather?: FavoriteCurrent;
  loading: boolean;
  isActive: boolean;
  editMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function FavoriteItem({
  favorite,
  weather,
  loading,
  isActive,
  editMode,
  isFirst,
  isLast,
  onSelect,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const subtitle = [favorite.region, favorite.country].filter(Boolean).join(" · ");

  const Wrapper = editMode ? "div" : ("button" as const);

  return (
    <>
      <Wrapper
        {...(!editMode && { onClick: onSelect, type: "button" as const })}
        className={`group flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors min-h-[56px] ${
          editMode
            ? ""
            : "hover:bg-foreground/5 cursor-pointer"
        } ${isActive ? "bg-primary/10 border-primary/20" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{favorite.name}</div>
          {subtitle && (
            <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
          )}
        </div>

        {editMode ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              aria-label="Nach oben"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              aria-label="Nach unten"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowDown className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              aria-label="Entfernen"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2.5">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : weather ? (
              <>
                <span className="font-display text-base font-medium tabular-nums">
                  {Math.round(weather.temperature)}°
                </span>
                <EffectiveWeatherIcon
                  code={weather.weatherCode}
                  precipitation={weather.precipitation}
                  cloudCover={weather.cloudCover}
                  isDay={weather.isDay}
                  className="h-5 w-5 text-primary"
                />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        )}
      </Wrapper>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Favorit entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {favorite.name} wird aus deinen Favoriten gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
