import { useState } from "react";
import { Star } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { FavoritesPanel } from "./FavoritesPanel";

export function FavoritesButton() {
  const [open, setOpen] = useState(false);
  const { favorites } = useFavorites();
  const count = favorites.length;
  const hasAny = count > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Favoriten öffnen${hasAny ? ` (${count})` : ""}`}
        title="Favoriten"
        className={`relative grid h-9 w-9 place-items-center rounded-full border transition-all active:scale-95 ${
          hasAny
            ? "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
            : "border-border text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <Star
          className={`h-4 w-4 ${hasAny ? "fill-current" : ""}`}
          strokeWidth={1.75}
        />
        {hasAny && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow ring-2 ring-background">
            {count}
          </span>
        )}
      </button>
      <FavoritesPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
