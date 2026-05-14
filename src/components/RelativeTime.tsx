import { useEffect, useState } from "react";

function format(diffMs: number): string {
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 45) return "vor wenigen Sekunden";
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return `vor ${d} Tg`;
}

export function RelativeTime({ timestamp }: { timestamp: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!timestamp) return null;
  return <>Aktualisiert {format(Date.now() - timestamp)}</>;
}
