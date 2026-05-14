import { useState } from "react";
import { Nowcast } from "@/components/Nowcast";
import { SectionHeader } from "@/components/SectionHeader";
import { PageState } from "@/components/PageState";

type Range = 8 | 24;

export function NowcastPage() {
  const [range, setRange] = useState<Range>(8);

  return (
    <PageState>
      {(data) => (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <SectionHeader
              title="Nowcast"
              subtitle={`${(range * 15) / 60} h Niederschlagsverlauf`}
            />
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
  );
}
