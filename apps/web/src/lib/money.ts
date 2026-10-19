/** Paise to a rupee string for display: 30000 -> "₹300", 1550 -> "₹15.50". */
export function formatRupees(paise: number, locale = 'en-IN'): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString(locale, { maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2 })}`;
}

/** Form input in rupees to paise; `null` for an empty field, `NaN` for junk. */
export function rupeesToPaise(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
  return Math.round(Number(trimmed) * 100);
}

export function paiseToRupeesInput(paise: number | null): string {
  if (paise === null) return '';
  const rupees = paise / 100;
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}
