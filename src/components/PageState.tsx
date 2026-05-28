import { CloudOff, Loader2, MapPinOff } from "lucide-react";
import { useState } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { WeatherLoader } from "@/components/loaders/WeatherLoader";
import type { ReactNode } from "react";

export function UnsupportedLocationNotice() {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl p-12 text-center">
      <MapPinOff className="h-10 w-10 text-muted-foreground" />
      <p className="max-w-md text-muted-foreground">
        Für diesen Standort sind aktuell keine detaillierten Vorhersagedaten verfügbar.
        Bitte versuche einen anderen Ort in der Nähe.
      </p>
    </div>
  );
}

export function PageState({ children }: { children: (data: NonNullable<ReturnType<typeof useWeather>["data"]>) => ReactNode }) {
  const { data, isLoading, isError, errorCode, refresh, location } = useWeather();
  const [retrying, setRetrying] = useState(false);

  if (isLoading && !data) return <WeatherLoader city={location?.name} />;

  if (errorCode === "unsupported_location") {
    return <UnsupportedLocationNotice />;
  }

  if (isError && !data) {
    const handleRetry = async () => {
      if (retrying) return;
      setRetrying(true);
      try {
        await Promise.resolve(refresh());
      } finally {
        setRetrying(false);
      }
    };
    return (
      <div className="glass flex flex-col items-center gap-4 rounded-3xl p-12 text-center">
        <CloudOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          Konnte Daten nicht laden – nächster Versuch in 5 Min.
        </p>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-primary-foreground transition-opacity disabled:cursor-wait disabled:opacity-70"
        >
          {retrying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {retrying ? "Wird geladen…" : "Erneut versuchen"}
        </button>
      </div>
    );
  }

  if (!data) {
    return <WeatherLoader city={location?.name} compact />;
  }

  return <>{children(data)}</>;
}
