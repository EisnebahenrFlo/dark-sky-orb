export const safeFixed = (
  value: number | null | undefined,
  decimals = 1,
  fallback = "–",
): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return value.toFixed(decimals);
};
