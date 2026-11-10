// Net balance of every member (DAN-51): the one calculation every summary and the settlement use.
// A pure function over integer minor units, run on the server and reusable in the browser.

export type BalanceTransactionType = 'expense' | 'income' | 'fund_contribution' | 'transfer';

/** The parts of a (not deleted) transaction the balances need. Ids are plain strings. */
export interface BalanceTransaction {
  type: BalanceTransactionType;
  amount: number;
  paidByMemberId?: string | null;
  receivedByMemberId?: string | null;
  paidFromFund?: boolean | null;
  /** Resolved split amounts, which add up to `amount`. Expenses and income only. */
  participants?: { memberId: string; amount: number }[] | null;
}

export interface MemberBalance {
  memberId: string;
  /** Expenses they paid out of pocket. */
  paid: number;
  /** Their share of all expenses, including those paid from the fund. */
  share: number;
  /** Income they received and are holding for the group. */
  received: number;
  /** Their share of income. */
  incomeShare: number;
  /** What they paid into the initial fund. */
  contributed: number;
  /** Settlement transfers they sent and received. */
  sent: number;
  got: number;
  /**
   * Fund money they hold (collected − spent from the fund), when they are the fund holder.
   * Negative when the fund is overspent, so the holder is owed the difference.
   */
  holdsFund: number;
  /** Positive: should receive. Negative: should pay. */
  balance: number;
}

export interface Balances {
  members: MemberBalance[];
  /**
   * Fund money nobody is named as holding (collected − spent from the fund), with the same sign
   * rule as a member balance: negative while there is money left in the fund. Zero when a holder
   * was given, since it is then part of that member's balance.
   */
  fund: number;
  /** Total of all expenses, from any source. */
  totalExpenses: number;
}

const empty = (memberId: string): MemberBalance => ({
  memberId,
  paid: 0,
  share: 0,
  received: 0,
  incomeShare: 0,
  contributed: 0,
  sent: 0,
  got: 0,
  holdsFund: 0,
  balance: 0,
});

/**
 * Net balance per member:
 *
 *   + expenses paid out of pocket − share of all expenses
 *   − income received and held   + share of income
 *   + fund contributions paid in − fund money held as treasurer (collected − spent from fund)
 *   + settlement transfers sent  − settlement transfers received
 *
 * `memberIds` sets the order of the result (members in no transaction get a zero row); anyone
 * else who appears in a transaction, such as a removed member, is added after them. The member
 * balances plus `fund` always sum to exactly 0.
 */
export function computeBalances(
  memberIds: string[],
  transactions: BalanceTransaction[],
  { fundHolderId = null }: { fundHolderId?: string | null } = {},
): Balances {
  const rows = new Map<string, MemberBalance>(memberIds.map((id) => [id, empty(id)]));
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = empty(id)));
    return r;
  };

  let fundCollected = 0;
  let fundSpent = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    const participants = t.participants ?? [];
    switch (t.type) {
      case 'expense':
        totalExpenses += t.amount;
        if (t.paidFromFund) fundSpent += t.amount;
        else if (t.paidByMemberId) row(t.paidByMemberId).paid += t.amount;
        for (const p of participants) row(p.memberId).share += p.amount;
        break;
      case 'income':
        if (t.receivedByMemberId) row(t.receivedByMemberId).received += t.amount;
        for (const p of participants) row(p.memberId).incomeShare += p.amount;
        break;
      case 'fund_contribution':
        fundCollected += t.amount;
        if (t.paidByMemberId) row(t.paidByMemberId).contributed += t.amount;
        break;
      case 'transfer':
        if (t.paidByMemberId) row(t.paidByMemberId).sent += t.amount;
        if (t.receivedByMemberId) row(t.receivedByMemberId).got += t.amount;
        break;
    }
  }

  const fundHeld = fundCollected - fundSpent;
  if (fundHolderId) row(fundHolderId).holdsFund = fundHeld;

  const members = [...rows.values()];
  for (const r of members) {
    r.balance =
      r.paid - r.share - r.received + r.incomeShare + r.contributed - r.holdsFund + r.sent - r.got;
  }
  // `|| 0` turns -0 into 0, so an empty fund reads as zero.
  const fund = fundHolderId ? 0 : -fundHeld || 0;

  const sum = members.reduce((s, r) => s + r.balance, fund);
  if (sum !== 0) throw new Error(`Balances sum to ${sum}, not 0: a transaction's split is off`);
  return { members, fund, totalExpenses };
}
