export function isPostalCode(input: string): boolean {
  const trimmed = input.trim();
  // 4-stellig: Österreich oder Schweiz
  // 5-stellig: Deutschland oder Italien
  return /^\d{4,5}$/.test(trimmed);
}

export function getCountryCodeHint(_input: string): string | undefined {
  // Open-Meteo erkennt PLZ direkt — kein eindeutiger Filter nötig.
  return undefined;
}
