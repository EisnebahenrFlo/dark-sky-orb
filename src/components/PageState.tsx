import { CloudOff, Loader2 } from "lucide-react";
import { useWeather } from "@/contexts/WeatherContext";
import { WeatherSkeleton } from "@/components/WeatherSkeleton";
import type { ReactNode } from "react";

export function PageState({ children }: { children: (data: NonNullable<ReturnType<typeof useWeather>["data"]>) => ReactNode }) {
  const { data, isLoading, isError, refresh } = useWeather();

  if (isLoading && !data) return <WeatherSkeleton />;

  if (isError && !data) {
    return (
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-12 text-center">
        <CloudOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Konnte Daten nicht laden – nächster Versuch in 5 Min.
        </p>
        <button
          onClick={() => refresh()}
          className="rounded-xl bg-primary px-5 py-2 font-medium text-primary-foreground"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children(data)}</>;
}
