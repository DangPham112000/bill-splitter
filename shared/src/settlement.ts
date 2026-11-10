// Turn net balances (DAN-51) into the fewest "A pays B" transfers (DAN-52).
// Pure functions over integer minor units, run on the server and reusable in the browser.

import { currencyDecimals } from './money.js';

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface RoundingAdjustment {
  memberId: string;
  /** How far the rounded balance is from the real one: positive means they get more or pay less. */
  difference: number;
}

export interface Settlement {
  transfers: Transfer[];
  /** False when the group was too big for the exact search and the greedy result is shown. */
  exact: boolean;
  /** Set when transfers were rounded: who gains or loses what, the absorber included. */
  rounding: RoundingAdjustment[];
}

export interface SettlementOptions {
  /**
   * Round every transfer to a multiple of this (e.g. 1000 for 1.000 ₫). Each balance is rounded
   * to the nearest multiple and one person absorbs what is left: the hub if there is one,
   * otherwise whoever has the largest balance.
   */
  roundTo?: number | null;
  /** Route every payment through this member (usually the treasurer) instead. */
  hubId?: string | null;
  /** Largest number of non-zero balances searched exactly; bigger groups use the greedy method. */
  exactLimit?: number;
}

/** 2^20 subsets, about 20M steps: well under a second on a phone. */
export const EXACT_LIMIT = 20;

type Entry = { id: string; balance: number };

// Sorting by id first makes every result the same for the same balances, whatever their order.
const byId = (a: Entry, b: Entry) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Settle a group whose balances sum to 0 by matching the largest debtor with the largest
 * creditor until everyone is even. Each transfer clears at least one person, so a group of k
 * people needs at most k − 1 transfers.
 */
export function greedyTransfers(entries: Entry[]): Transfer[] {
  const left = entries.filter((e) => e.balance !== 0).map((e) => ({ ...e }));
  const transfers: Transfer[] = [];
  const largest = (sign: 1 | -1) =>
    left
      .filter((e) => Math.sign(e.balance) === sign)
      .reduce<Entry | null>(
        (best, e) =>
          !best ||
          Math.abs(e.balance) > Math.abs(best.balance) ||
          (Math.abs(e.balance) === Math.abs(best.balance) && byId(e, best) < 0)
            ? e
            : best,
        null,
      );
  for (;;) {
    const creditor = largest(1);
    const debtor = largest(-1);
    if (!creditor || !debtor) break;
    const amount = Math.min(creditor.balance, -debtor.balance);
    transfers.push({ from: debtor.id, to: creditor.id, amount });
    creditor.balance -= amount;
    debtor.balance += amount;
  }
  return transfers;
}

/**
 * Split the balances into as many disjoint zero-sum groups as possible (bitmask DP over subsets).
 * Each group of k settles with k − 1 transfers, so n − groups is the true minimum.
 *
 * best[mask] is the largest number of zero-sum prefixes over every ordering of mask's members:
 * cutting an ordering at those prefixes gives the groups.
 */
function zeroSumGroups(values: number[]): number[][] {
  const n = values.length;
  const size = 1 << n;
  const sum = new Float64Array(size);
  const best = new Uint8Array(size);
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    sum[mask] = sum[mask ^ low] + values[31 - Math.clz32(low)];
    let most = 0;
    for (let rest = mask; rest; rest &= rest - 1) {
      const value = best[mask ^ (rest & -rest)];
      if (value > most) most = value;
    }
    best[mask] = most + (sum[mask] === 0 ? 1 : 0);
  }

  // Walk back from the full set, taking off the lowest member that keeps the best count.
  const order: number[] = [];
  for (let mask = size - 1; mask;) {
    const target = best[mask] - (sum[mask] === 0 ? 1 : 0);
    for (let rest = mask; rest; rest &= rest - 1) {
      const bit = rest & -rest;
      if (best[mask ^ bit] === target) {
        order.unshift(31 - Math.clz32(bit));
        mask ^= bit;
        break;
      }
    }
  }

  const groups: number[][] = [];
  let group: number[] = [];
  let running = 0;
  for (const i of order) {
    group.push(i);
    running += values[i];
    if (running === 0) {
      groups.push(group);
      group = [];
    }
  }
  return groups;
}

/** The fewest transfers: exact for up to `exactLimit` people, greedy above that. */
export function minimumTransfers(
  entries: Entry[],
  exactLimit = EXACT_LIMIT,
): { transfers: Transfer[]; exact: boolean } {
  const nonZero = entries.filter((e) => e.balance !== 0).sort(byId);
  if (nonZero.length > exactLimit) return { transfers: greedyTransfers(nonZero), exact: false };
  const groups = zeroSumGroups(nonZero.map((e) => e.balance));
  return {
    transfers: groups.flatMap((g) => greedyTransfers(g.map((i) => nonZero[i]))),
    exact: true,
  };
}

/** Everyone who owes pays the hub, and the hub pays everyone who is owed. */
function hubTransfers(entries: Entry[], hubId: string): Transfer[] {
  const others = entries.filter((e) => e.id !== hubId && e.balance !== 0).sort(byId);
  return [
    ...others
      .filter((e) => e.balance < 0)
      .map((e) => ({ from: e.id, to: hubId, amount: -e.balance })),
    ...others
      .filter((e) => e.balance > 0)
      .map((e) => ({ from: hubId, to: e.id, amount: e.balance })),
  ];
}

/** Nearest multiple of `step`, halves away from zero. */
const roundToStep = (value: number, step: number) =>
  Math.sign(value) * Math.round(Math.abs(value) / step) * step || 0;

function roundBalances(
  entries: Entry[],
  step: number,
  absorberId: string | null,
): { entries: Entry[]; rounding: RoundingAdjustment[] } {
  const rounded = entries.map((e) => ({ id: e.id, balance: roundToStep(e.balance, step) }));
  const leftover = rounded.reduce((s, e) => s + e.balance, 0);
  if (leftover !== 0) {
    // The leftover is a multiple of the step too, so the absorber's balance stays round.
    const absorber =
      rounded.find((e) => e.id === absorberId) ??
      [...entries].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || byId(a, b))[0];
    rounded.find((e) => e.id === absorber.id)!.balance -= leftover;
  }
  const rounding = rounded
    .map((e, i) => ({ memberId: e.id, difference: e.balance - entries[i].balance }))
    .filter((r) => r.difference !== 0);
  return { entries: rounded, rounding };
}

/**
 * Who pays whom so every balance ends at 0. `balances` must sum to 0 (see computeBalances).
 * The same balances always give the same transfers, so the list does not change between refreshes.
 */
export function settle(balances: Entry[], options: SettlementOptions = {}): Settlement {
  const total = balances.reduce((s, e) => s + e.balance, 0);
  if (total !== 0) throw new RangeError(`Balances sum to ${total}, not 0`);
  const step = options.roundTo && options.roundTo > 1 ? Math.floor(options.roundTo) : null;
  const hubId =
    options.hubId && balances.some((e) => e.id === options.hubId) ? options.hubId : null;

  let entries = balances.map((e) => ({ id: e.id, balance: e.balance }));
  let rounding: RoundingAdjustment[] = [];
  if (step) ({ entries, rounding } = roundBalances(entries, step, hubId));

  if (hubId) return { transfers: hubTransfers(entries, hubId), exact: true, rounding };
  return { ...minimumTransfers(entries, options.exactLimit), rounding };
}

/** The step the "round transfers" option uses: 1.000 ₫ for VND, one whole unit (1 ฿) otherwise. */
export const roundingStepFor = (currency: string) =>
  currency === 'VND' ? 1000 : 10 ** currencyDecimals(currency);
