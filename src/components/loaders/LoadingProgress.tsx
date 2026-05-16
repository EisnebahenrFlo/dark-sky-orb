import { useEffect, useState } from "react";

export interface LoadingPhase {
  label: string;
  targetProgress: number;
  duration: number;
}

interface Props {
  phases: LoadingPhase[];
  /** When true, jump to 100% and finish. */
  complete?: boolean;
}

/**
 * Step-based loading bar.
 * - Animates through phases in sequence using their targetProgress + duration.
 * - If reaching the last phase without `complete`, hangs at that phase's progress.
 * - When `complete` flips true, jumps to 100%.
 */
export function LoadingProgress({ phases, complete = false }: Props) {
  const [progress, setProgress] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    if (complete) {
      setProgress(100);
      setPhaseIdx(phases.length - 1);
      return;
    }
    let cancelled = false;
    let prevTarget = 0;

    const runPhase = async (i: number) => {
      if (cancelled || i >= phases.length) return;
      setPhaseIdx(i);
      const phase = phases[i];
      const start = performance.now();
      const from = prevTarget;
      const to = phase.targetProgress;
      const dur = phase.duration;

      const tick = (t: number) => {
        if (cancelled) return;
        const elapsed = t - start;
        const k = Math.min(1, elapsed / dur);
        // ease-out
        const eased = 1 - Math.pow(1 - k, 2);
        setProgress(from + (to - from) * eased);
        if (k < 1) requestAnimationFrame(tick);
        else {
          prevTarget = to;
          if (i < phases.length - 1) runPhase(i + 1);
          // last phase: hang until `complete`
        }
      };
      requestAnimationFrame(tick);
    };

    runPhase(0);
    return () => {
      cancelled = true;
    };
  }, [phases, complete]);

  const current = phases[Math.min(phaseIdx, phases.length - 1)];
  const pct = Math.round(progress);

  return (
    <div className="w-full max-w-xs">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 h-full rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent bg-[length:200%_100%] animate-shimmer"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 text-center text-xs text-muted-foreground">
        Schritt {Math.min(phaseIdx + 1, phases.length)} von {phases.length}: {current.label}
      </div>
    </div>
  );
}
