import { useState } from "react";
import { CloudLightning, Zap, Home, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ErrorSplashType = "generic" | "network" | "404";

const COPY: Record<ErrorSplashType, { title: string; subtitle: string }> = {
  generic: {
    title: "Hoppla!",
    subtitle:
      "Etwas ist schiefgelaufen. Versuche es nochmal oder geh zurück zur Startseite.",
  },
  network: {
    title: "Hoppla!",
    subtitle:
      "Keine Verbindung. Prüfe dein Internet und versuche es erneut.",
  },
  "404": {
    title: "Hoppla!",
    subtitle: "Diese Seite gibt's nicht. Vielleicht falsch abgebogen?",
  },
};

interface Props {
  type?: ErrorSplashType;
  error?: Error | null;
  onReset?: () => void;
}

export function ErrorSplash({ type = "generic", error, onReset }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const { title, subtitle } = COPY[type];

  const goHome = () => {
    window.location.href = "/";
  };

  const retry = () => {
    if (onReset) onReset();
    else window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-4"
      style={{
        background:
          "radial-gradient(ellipse at top, var(--bg-grad-1), transparent 60%), radial-gradient(ellipse at bottom right, var(--bg-grad-2), transparent 55%), var(--background)",
      }}
      role="alert"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {/* Animation */}
        <div className="relative h-32 w-40">
          <CloudLightning
            className="absolute left-1/2 top-4 h-20 w-20 -translate-x-1/2 text-primary animate-float drop-shadow-xl"
            strokeWidth={1.5}
          />
          <Zap
            className="absolute right-3 top-10 h-8 w-8 text-accent animate-pulse-glow"
            strokeWidth={1.75}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 flex gap-2"
            style={{ top: "92px" }}
          >
            {[0, 0.3, 0.6].map((d, i) => (
              <span
                key={i}
                className="block h-3 w-1 rounded-full bg-primary/60 animate-rain"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </div>
        </div>

        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-primary">{title}</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={goHome} className="gap-2">
            <Home className="h-4 w-4" />
            Zurück zur Startseite
          </Button>
          <Button onClick={retry} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Erneut versuchen
          </Button>
        </div>

        {error && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
              Technische Details
            </button>
            {showDetails && (
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-border/50 bg-muted/30 p-3 text-left text-[10px] text-muted-foreground">
                {error.message}
                {error.stack ? `\n\n${error.stack}` : ""}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
