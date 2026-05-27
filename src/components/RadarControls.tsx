import { Play, Pause, SkipBack, SkipForward, Rewind } from "lucide-react";
import type { RainbowFrame } from "@/lib/rainbow";

interface Props {
  frames: RainbowFrame[];
  pastCount: number;
  index: number;
  isPlaying: boolean;
  onToggle: () => void;
  onSeek: (i: number) => void;
}

export function RadarControls({ frames, pastCount, index, isPlaying, onToggle, onSeek }: Props) {
  const current = frames[index];
  if (!current) return null;
  const isForecast = index >= pastCount;
  const time = new Date(current.time * 1000).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Relative label vs. "now" (last past frame)
  const nowIdx = Math.max(0, pastCount - 1);
  const offsetMin = Math.round((current.time - (frames[nowIdx]?.time ?? current.time)) / 60);
  const relLabel =
    offsetMin === 0
      ? "Jetzt"
      : offsetMin > 0
      ? `+${offsetMin} Min`
      : `${offsetMin} Min`;

  const goNow = () => onSeek(nowIdx);
  const goPrev = () => onSeek(Math.max(0, index - 1));
  const goNext = () => onSeek(Math.min(frames.length - 1, index + 1));

  const pctNow = (nowIdx / Math.max(1, frames.length - 1)) * 100;

  return (
    <div className="glass mt-3 rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={goPrev}
          aria-label="Vorheriger Frame"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <SkipBack className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <button
          onClick={onToggle}
          aria-label={isPlaying ? "Pause" : "Abspielen"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Play className="ml-0.5 h-4 w-4" strokeWidth={2.5} />
          )}
        </button>

        <button
          onClick={goNext}
          aria-label="Nächster Frame"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <SkipForward className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <div className="relative flex-1 px-1">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={index}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Zeitpunkt wählen"
            className="radar-range h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          {pastCount > 0 && pastCount < frames.length && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-accent"
              style={{ left: `calc(${pctNow}% + 4px)` }}
            />
          )}
        </div>

        <div className="w-20 shrink-0 text-right sm:w-24">
          <div className="font-display text-base leading-none tabular-nums sm:text-lg">{time}</div>
          <div
            className={`mt-0.5 text-[10px] uppercase tracking-wider ${
              isForecast ? "text-accent" : "text-muted-foreground"
            }`}
          >
            {isForecast ? "Vorhersage" : "Beobachtung"}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <button
          onClick={goNow}
          className="flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Zu Jetzt springen"
        >
          <Rewind className="h-3 w-3" strokeWidth={2} />
          <span>Jetzt</span>
        </button>
        <span className="tabular-nums">{relLabel}</span>
        <span className="tabular-nums">
          {index + 1} / {frames.length}
        </span>
      </div>
    </div>
  );
}
