// Amounts are shown and typed the Vietnamese way even though the UI is in English:
// dots group thousands and a comma marks decimals, so 1250000 dong reads "1.250.000 ₫".

import { DEFAULT_CURRENCY, currencyDecimals, isAmount } from './money.js';

const GROUP = '.';
const DECIMAL = ',';
const NBSP = ' ';

/** Shorthand suffixes and the power of ten they multiply by: 50k = 50.000, 1.2tr = 1.200.000. */
const SHORTHANDS: Record<string, number> = { k: 3, tr: 6, m: 6 };

const symbols = new Map<string, string>();

/** Narrow symbol of a currency: "₫" for VND, "฿" for THB, "¥" for CNY. */
export function currencySymbol(currency: string): string {
  let symbol = symbols.get(currency);
  if (symbol === undefined) {
    symbol =
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency;
    symbols.set(currency, symbol);
  }
  return symbol;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
}

/**
 * Format an integer minor-unit amount: `formatAmount(1250000)` is "1.250.000 ₫" and
 * `formatAmount(12050, 'THB')` is "120,50 ฿". Pass `{ symbol: false }` for just the number.
 * Negative amounts (balances) get a leading minus sign.
 */
export function formatAmount(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  { symbol = true }: { symbol?: boolean } = {},
): string {
  if (!Number.isSafeInteger(amount)) throw new RangeError(`Invalid amount: ${amount}`);
  const decimals = currencyDecimals(currency);
  // Work on the digit string rather than dividing, so no float rounding creeps in.
  const digits = Math.abs(amount)
    .toString()
    .padStart(decimals + 1, '0');
  const integer = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  const number =
    (amount < 0 ? '-' : '') + groupThousands(integer) + (fraction ? DECIMAL + fraction : '');
  return symbol ? `${number}${NBSP}${currencySymbol(currency)}` : number;
}

/** True when the text uses a shorthand suffix such as "50k" or "1.2tr". */
export function isShorthandAmount(input: string): boolean {
  return /\d\s*(k|tr|m)\s*$/i.test(input.trim());
}

/** Dots or commas between digits are valid thousands grouping only in groups of three. */
function isValidGrouping(integer: string): boolean {
  return /^\d{1,3}([.,]\d{3})*$/.test(integer) || /^\d+$/.test(integer);
}

/**
 * Parse what a person typed into an integer minor-unit amount, or `null` if it is not one.
 *
 * - "1.250.000", "1,250,000" and "1250000" are all 1.250.000.
 * - "50k" is 50.000; "1.2tr", "1,2tr" and "1.2m" are 1.200.000 (the separator before a suffix is a decimal).
 * - For currencies with decimals the comma is the decimal mark ("120,50"); a single dot followed by
 *   no more digits than the currency allows ("120.5") is read as a decimal too.
 * - A trailing currency symbol or code ("50.000 ₫", "50.000đ", "50000 VND") is ignored.
 *
 * Amounts that are not a whole number of minor units ("1.2345k" in VND) return `null`.
 */
export function parseAmount(input: string, currency: string = DEFAULT_CURRENCY): number | null {
  const decimals = currencyDecimals(currency);
  let text = input.toLowerCase().replace(/\s/g, '');
  for (const suffix of [currency.toLowerCase(), currencySymbol(currency).toLowerCase(), '₫', 'đ']) {
    if (suffix && text.endsWith(suffix)) {
      text = text.slice(0, -suffix.length);
      break;
    }
  }

  const match = /^(\d[\d.,]*?)(k|tr|m)?$/.exec(text);
  if (!match) return null;
  const [, number, suffix] = match;
  if (/[.,]$/.test(number) || /[.,]{2}/.test(number)) return null;

  const separators = number.replace(/\d/g, '');
  let integer = number;
  let fraction = '';
  const lastSeparator = Math.max(number.lastIndexOf('.'), number.lastIndexOf(','));
  const splitAtLast = () => {
    integer = number.slice(0, lastSeparator);
    fraction = number.slice(lastSeparator + 1);
  };

  if (separators.length > 0) {
    const mixed = separators.includes('.') && separators.includes(',');
    if (suffix) {
      // "1.2tr": a single separator (or the last of mixed ones) before a suffix is the decimal mark.
      if (mixed || separators.length === 1) splitAtLast();
    } else if (decimals > 0) {
      const afterLast = number.length - lastSeparator - 1;
      if (mixed || separators === DECIMAL) splitAtLast();
      else if (separators === '.' && afterLast <= decimals) splitAtLast();
    }
  }

  if (!isValidGrouping(integer)) return null;
  integer = integer.replace(/[.,]/g, '');
  if (!suffix && fraction.length > decimals) return null;

  // Shift the decimal point without floats: digits × 10^power.
  let digits = integer + fraction;
  const power = (suffix ? SHORTHANDS[suffix] : 0) + decimals - fraction.length;
  if (power >= 0) {
    digits += '0'.repeat(power);
  } else {
    if (!/^0+$/.test(digits.slice(power))) return null;
    digits = digits.slice(0, power);
  }

  const amount = Number(digits.replace(/^0+(?=\d)/, ''));
  return isAmount(amount) ? amount : null;
}

/**
 * Regroup an amount while it is being typed, so "1250000" shows as "1.250.000".
 * Text with a shorthand suffix or anything else unexpected is returned unchanged, to be parsed later.
 * A comma starts the decimals for currencies that have them; extra decimal digits are dropped.
 */
export function formatAmountInput(input: string, currency: string = DEFAULT_CURRENCY): string {
  if (!/^[\d.,\s]*$/.test(input)) return input;
  const decimals = currencyDecimals(currency);
  const commaAt = decimals > 0 ? input.indexOf(DECIMAL) : -1;
  const integerText = commaAt >= 0 ? input.slice(0, commaAt) : input;
  const integer = integerText.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (commaAt < 0) return groupThousands(integer);
  const fraction = input
    .slice(commaAt + 1)
    .replace(/\D/g, '')
    .slice(0, decimals);
  return `${groupThousands(integer || '0')}${DECIMAL}${fraction}`;
}

/** Convert a whole number of major units (dong, baht) to minor units. */
export function toMinorUnits(major: number, currency: string = DEFAULT_CURRENCY): number {
  return major * 10 ** currencyDecimals(currency);
}

/** Short label for a round amount in major units: 10000 is "10k", 1500000 is "1.5tr". */
function shortLabel(major: number): string {
  if (major >= 1_000_000) return `${major / 1_000_000}tr`;
  if (major >= 1_000) return `${major / 1_000}k`;
  return String(major);
}

/** Quick-add chips for an amount input: +10k, +50k, +100k and +500k for VND. */
export function quickAddAmounts(
  currency: string = DEFAULT_CURRENCY,
): { label: string; amount: number }[] {
  const majors = currency === 'VND' ? [10_000, 50_000, 100_000, 500_000] : [10, 50, 100, 500];
  return majors.map((major) => ({
    label: `+${shortLabel(major)}`,
    amount: toMinorUnits(major, currency),
  }));
}
