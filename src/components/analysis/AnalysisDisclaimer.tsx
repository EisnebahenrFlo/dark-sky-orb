import { Info } from "lucide-react";

export function AnalysisDisclaimer() {
  return (
    <div className="mt-6 mb-4 rounded-2xl border border-border border-l-4 border-l-blue-400 bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" strokeWidth={1.75} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Hinweis zur KI-Analyse</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            MeteoFlo's Synoptiker-KI versucht das Wetter zu verstehen wie ein Profi – ist aber
            selbst noch im Training. Behandle die Analyse als gut informierte Einschätzung, nicht
            als Verkündigung. Bei akuten Wetterlagen bitte amtliche Quellen wie DWD, ZAMG oder
            MeteoSwiss konsultieren.
          </p>
        </div>
      </div>
    </div>
  );
}
