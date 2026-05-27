import { useState } from "react";
import { ArrowUp, ArrowDown, Trash2, Loader2, Check } from "lucide-react";
import type { Favorite } from "@/lib/favoritesStorage";
import type { FavoriteCurrent } from "@/hooks/useFavoriteWeather";
import { RealisticWeatherIcon } from "@/components/RealisticWeatherIcon";
import { getEffectiveCode } from "@/components/WeatherIcon";
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

  const subtitle = [favorite.region, favorite.country_code || favorite.country]
    .filter(Boolean)
    .join(" · ");

  const Wrapper = editMode ? "div" : ("button" as const);

  return (
    <>
      <Wrapper
        {...(!editMode && { onClick: onSelect, type: "button" as const })}
        className={`group relative flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all min-h-[60px] ${
          editMode ? "" : "hover:bg-foreground/5 active:bg-foreground/10 cursor-pointer"
        } ${
          isActive
            ? "bg-primary/10 ring-1 ring-primary/30"
            : ""
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!editMode && weather && (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground/5">
              <RealisticWeatherIcon
                code={getEffectiveCode(weather.weatherCode, weather.precipitation, weather.cloudCover)}
                isDay={(weather.isDay ? 1 : 0) as 0 | 1}
                size={28}
              />
            </div>
          )}
          {!editMode && !weather && loading && (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-foreground/5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-foreground">{favorite.name}</span>
              {isActive && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} /> Aktiv
                </span>
              )}
            </div>
            {subtitle && (
              <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              aria-label="Nach oben"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              aria-label="Nach unten"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowDown className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              aria-label="Entfernen"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center">
            {weather ? (
              <span className="font-display text-xl font-semibold tabular-nums text-foreground">
                {Math.round(weather.temperature)}°
              </span>
            ) : !loading ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : null}
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
                haptic("medium");
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
