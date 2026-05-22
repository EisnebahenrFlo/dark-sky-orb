import { useState } from "react";
import { Radio } from "lucide-react";
import { Nowcast } from "@/components/Nowcast";
import { PageState } from "@/components/PageState";
import { useWeather } from "@/contexts/WeatherContext";

type Range = 8 | 24;

export function NowcastPage() {
  const [range, setRange] = useState<Range>(8);
  const { location } = useWeather();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Radio className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span>
          Nowcast für <span className="font-medium text-foreground">{location.name}</span>
        </span>
      </div>
      <PageState>
        {(data) => (
          <div>
            <div className="mb-3 flex items-start justify-between gap-3 px-1">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-lg font-medium tracking-tight">Nowcast</h2>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {(range * 15) / 60} h Niederschlagsverlauf
                </span>
              </div>
              <div className="glass flex gap-0.5 rounded-full p-0.5 text-xs">
                {[8, 24].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r as Range)}
                    className={`rounded-full px-3 py-1 transition-colors ${
                      range === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {(r * 15) / 60}h
                  </button>
                ))}
              </div>
            </div>
            <Nowcast minutely={data.minutely_15} count={range} showHeader={false} />
          </div>
        )}
      </PageState>
    </div>
  );
}
