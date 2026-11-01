/**
 * Money handling.
 *
 * JOD has THREE decimal places (1 dinar = 1000 fils). Every amount is stored as
 * an integer number of fils ("minor units") so arithmetic never drifts like
 * `0.1 + 0.2` would with floats.
 */

export const MINOR_PER_MAJOR = 1000;

const ARABIC_LOCALE = 'ar-JO-u-nu-latn';

export function isZero(minor: number): boolean {
  return minor === 0;
}

/** Convert a user-entered decimal (12.5) into minor units (12500). */
export function toMinor(value: number): number {
  return Math.round(value * MINOR_PER_MAJOR);
}

/** Convert minor units back to a decimal number (12500 -> 12.5). */
export function toMajor(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

/**
 * Parse a free-text amount into minor units.
 * Accepts "12", "12.5", "12,500", " 1 200 " and Arabic-Indic digits.
 * Returns `null` when the input is not a usable number.
 */
export function parseAmount(raw: string): number | null {
  const normalized = raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\u00a0,٬]/g, '')
    .replace(/٫/g, '.')
    .trim();

  if (normalized === '') return null;
  if (!/^-?\d*(\.\d*)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return toMinor(value);
}

function localeTag(locale: string): string {
  return locale === 'ar' ? ARABIC_LOCALE : 'en-JO';
}

/** "JOD 12.500" / "١٢٫٥٠٠ JOD" — always three decimals for JOD. */
export function formatMoney(minor: number, currency = 'JOD', locale = 'en'): string {
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(toMajor(minor));
  } catch {
    return `${toMajor(minor).toFixed(3)} ${currency}`;
  }
}

/** Amount without the currency symbol — used inside dense table cells. */
export function formatAmount(minor: number, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }).format(toMajor(minor));
  } catch {
    return toMajor(minor).toFixed(3);
  }
}

/** Plain editable string for inputs: no grouping separators, no trailing zeros removed. */
export function toInputValue(minor: number): string {
  if (minor === 0) return '';
  const major = toMajor(minor);
  return Number.isInteger(major) ? String(major) : String(major);
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
