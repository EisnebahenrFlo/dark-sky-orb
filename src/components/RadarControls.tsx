import { Play, Pause } from "lucide-react";
import type { RainViewerFrame } from "@/lib/rainviewer";

interface Props {
  frames: RainViewerFrame[];
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

  return (
    <div className="glass mt-3 flex items-center gap-3 rounded-2xl p-3 sm:p-4">
      <button
        onClick={onToggle}
        aria-label={isPlaying ? "Pause" : "Abspielen"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Play className="ml-0.5 h-4 w-4" strokeWidth={2} />
        )}
      </button>

      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={index}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
        {pastCount > 0 && pastCount < frames.length && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-y-1/2 bg-accent"
            style={{ left: `${(pastCount / (frames.length - 1)) * 100}%` }}
          />
        )}
      </div>

      <div className="w-24 shrink-0 text-right">
        <div className="font-display text-lg leading-none tabular-nums">{time}</div>
        <div className={`text-[10px] uppercase tracking-wider ${isForecast ? "text-accent" : "text-muted-foreground"}`}>
          {isForecast ? "Vorhersage" : "Beobachtung"}
        </div>
      </div>
    </div>
  );
}
