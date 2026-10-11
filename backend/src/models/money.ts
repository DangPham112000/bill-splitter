// Money is always an integer number of VND (no floats, no minor units).

export function isVndAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isPositiveVndAmount(value: unknown): value is number {
  return isVndAmount(value) && value > 0;
}

// Mongoose validator for integer VND fields.
export const vndValidator = {
  validator: isVndAmount,
  message: (props: { value: unknown }) => `${String(props.value)} is not a whole VND amount`,
};

/**
 * Split `total` into integer shares proportional to `weights`, summing exactly to `total`.
 * Leftover dong from rounding go to the earliest entries, one each.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  if (!isVndAmount(total)) throw new RangeError(`Invalid VND amount: ${total}`);
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
