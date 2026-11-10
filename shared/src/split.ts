// How one expense or income is divided between members (DAN-45). Shared so the form can show the
// same amounts the server stores. Every amount is an integer in the currency's minor unit.

import { isAmount, isPositiveAmount } from './money.js';

export const SPLIT_METHODS = ['equal', 'exact', 'shares'] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export interface SplitParticipantInput {
  memberId: string;
  /** Weight for the "shares" method, e.g. 2 for an adult and 1 for a child. */
  shares?: number | null;
  /** Exact amount for the "exact" method. */
  amount?: number | null;
}

export interface SplitShare {
  memberId: string;
  shares?: number;
  amount: number;
}

/**
 * Divide `total` between the participants, in the order given (member order).
 *
 * - `equal` and `shares` round down, then hand the leftover minor units out one each: the payer
 *   first (when they take part), then the others in order. 100.000 / 3 paid by the second person
 *   is 33.333 + 33.334 + 33.333.
 * - `exact` takes the amounts as typed; they must add up to the total.
 *
 * Throws a RangeError with a message the form can show when the input does not add up.
 */
export function splitAmount(
  total: number,
  method: SplitMethod,
  participants: SplitParticipantInput[],
  payerId?: string | null,
): SplitShare[] {
  if (!isPositiveAmount(total)) throw new RangeError('The amount must be more than 0');
  if (participants.length === 0) throw new RangeError('Pick at least one person to split with');
  const ids = participants.map((p) => p.memberId);
  if (new Set(ids).size !== ids.length) throw new RangeError('Someone is in the split twice');

  if (method === 'exact') {
    const shares = participants.map((p) => {
      if (!isAmount(p.amount)) throw new RangeError('Enter an amount for everyone in the split');
      return { memberId: p.memberId, amount: p.amount };
    });
    const sum = shares.reduce((s, p) => s + p.amount, 0);
    if (sum !== total) throw new RangeError(`The amounts add up to ${sum}, not ${total}`);
    return shares;
  }

  const weights = participants.map((p) => {
    if (method === 'equal') return 1;
    if (!Number.isSafeInteger(p.shares) || (p.shares as number) < 1) {
      throw new RangeError('Shares must be whole numbers of at least 1');
    }
    return p.shares as number;
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total * weightSum)) throw new RangeError('The amount is too large');

  const amounts = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - amounts.reduce((a, b) => a + b, 0);
  // Payer first, then member order. remainder < participants.length, so one pass is enough.
  const payerIndex = payerId ? ids.indexOf(payerId) : -1;
  const others = [...ids.keys()].filter((i) => i !== payerIndex);
  const order = payerIndex < 0 ? others : [payerIndex, ...others];
  for (const i of order) {
    if (remainder === 0) break;
    amounts[i]++;
    remainder--;
  }

  return participants.map((p, i) => ({
    memberId: p.memberId,
    ...(method === 'shares' ? { shares: weights[i] } : {}),
    amount: amounts[i],
  }));
}
