import { cn } from "@/lib/utils";

function getConfidenceLabel(score: number) {
  if (score >= 65) return { label: "✓ Zuverlässige Analyse", color: "#1a6a1a", bg: "#e8f4e8" };
  if (score >= 40) return { label: "~ Eingeschränkte Datenlage", color: "#7a5800", bg: "#fef9e6" };
  return { label: "⚠ Unsichere Vorhersage", color: "#7a3000", bg: "#fef0e6" };
}

export function ConfidenceBadge({ score, reason }: { score: number; reason?: string }) {
  const { label, color, bg } = getConfidenceLabel(score);
  return (
    <span
      title={reason}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
      )}
      style={{ color, background: bg, borderColor: color + "33" }}
    >
      {label}
    </span>
  );
}
