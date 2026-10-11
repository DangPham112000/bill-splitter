// Amounts are always integers in the currency's minor unit: dong for VND (no decimals),
// satang for THB, fen for CNY, cents for USD. No floats are stored anywhere.

export const DEFAULT_CURRENCY = 'VND';

const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));

/** True for an ISO 4217 code such as "VND", "THB" or "CNY". */
export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && supportedCurrencies.has(value);
}

/** Decimal places of a currency's minor unit: 0 for VND and JPY, 2 for THB and CNY. */
export function currencyDecimals(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits!;
}

export function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isPositiveAmount(value: unknown): value is number {
  return isAmount(value) && value > 0;
}

/**
 * Split `total` into integer shares proportional to `weights`, summing exactly to `total`.
 * Leftover minor units from rounding go to the earliest entries, one each.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  if (!isAmount(total)) throw new RangeError(`Invalid amount: ${total}`);
  if (weights.length === 0) throw new RangeError('Cannot split between zero participants');
  if (!weights.every((w) => Number.isSafeInteger(w) && w > 0)) {
    throw new RangeError('Weights must be positive integers');
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - shares.reduce((a, b) => a + b, 0);
  for (let i = 0; remainder > 0; i = (i + 1) % shares.length, remainder--) shares[i]++;
  return shares;
}

export function splitEqually(total: number, count: number): number[] {
  return splitByWeights(
    total,
    Array.from({ length: count }, () => 1),
  );
}
