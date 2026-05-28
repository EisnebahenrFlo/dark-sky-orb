import { StatusBadge } from "@/components/ui/status-badge";

export function LiveBadge() {
  return (
    <StatusBadge tone="live" size="xs" uppercase pulse aria-label="Live-Daten">
      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden /> Live
    </StatusBadge>
  );
}
