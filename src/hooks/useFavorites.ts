import { useCallback, useEffect, useState } from "react";
import {
  loadFavorites,
  saveFavorites,
  MAX_FAVORITES,
  type Favorite,
} from "@/lib/favoritesStorage";

const EVT = "meteoflo:favorites-changed";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
    const sync = () => setFavorites(loadFavorites());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = (next: Favorite[]) => {
    saveFavorites(next);
    setFavorites(next);
    window.dispatchEvent(new Event(EVT));
  };

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  const addFavorite = useCallback(
    (fav: Favorite): { ok: boolean; reason?: "duplicate" | "max" } => {
      const current = loadFavorites();
      if (current.some((f) => f.id === fav.id)) return { ok: false, reason: "duplicate" };
      if (current.length >= MAX_FAVORITES) return { ok: false, reason: "max" };
      persist([...current, fav]);
      return { ok: true };
    },
    [],
  );

  const removeFavorite = useCallback((id: string) => {
    persist(loadFavorites().filter((f) => f.id !== id));
  }, []);

  const reorderFavorites = useCallback((next: Favorite[]) => {
    persist(next);
  }, []);

  const moveFavoriteUp = useCallback((id: string) => {
    const list = loadFavorites();
    const i = list.findIndex((f) => f.id === id);
    if (i <= 0) return;
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    persist(list);
  }, []);

  const moveFavoriteDown = useCallback((id: string) => {
    const list = loadFavorites();
    const i = list.findIndex((f) => f.id === id);
    if (i < 0 || i >= list.length - 1) return;
    [list[i + 1], list[i]] = [list[i], list[i + 1]];
    persist(list);
  }, []);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    reorderFavorites,
    moveFavoriteUp,
    moveFavoriteDown,
    isFavorite,
    max: MAX_FAVORITES,
  };
}
