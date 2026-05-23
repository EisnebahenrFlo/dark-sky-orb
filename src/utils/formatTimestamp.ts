export function formatTimestamp(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "Gerade aktualisiert";
  if (diffMin < 60) return `vor ${diffMin} Min. aktualisiert`;
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `Abgerufen um ${h}:${m} Uhr`;
}
