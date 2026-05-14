import { Zap } from "lucide-react";
import { useWeather } from "@/contexts/WeatherContext";

export function LightningEmbed() {
  const { location } = useWeather();
  const url = `https://map.blitzortung.org/#5/${location.latitude.toFixed(2)}/${location.longitude.toFixed(2)}`;

  return (
    <div className="space-y-3">
      <div className="glass flex items-start gap-3 rounded-2xl p-4 text-sm text-muted-foreground">
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
        <p>
          Live-Blitzdetektion via{" "}
          <a
            href="https://www.blitzortung.org/"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            blitzortung.org
          </a>{" "}
          (Community-Netzwerk). Daten aktualisieren sich automatisch.
        </p>
      </div>
      <div className="glass overflow-hidden rounded-3xl">
        <iframe
          title="Blitzortung"
          src={url}
          className="block h-[500px] w-full border-0 sm:h-[600px]"
          loading="lazy"
        />
      </div>
    </div>
  );
}
