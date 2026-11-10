import { Link } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { EXPENSE_CATEGORIES, formatAmount, formatDay } from '@bill-splitter/shared';
import {
  SPLITTER_EXPENSES,
  type MemberBalance,
  type MemberRef,
  type Transaction,
} from '../graphql/transactions';
import { btn, cardClass } from '../lib/styles';
import { Card, EmptyState, Icon, Loading, SectionTitle } from './ui';

type Data = {
  splitter: {
    id: string;
    me: MemberRef | null;
    transactions: Transaction[];
    balances: { totalExpenses: number; members: MemberBalance[] };
  } | null;
};

const emojiOf = (category: string | null) =>
  EXPENSE_CATEGORIES.find((c) => c.id === category)?.emoji ?? '🧾';

/** The Expenses tab (DAN-43): totals, then every expense grouped by day, newest first. */
export function ExpenseList({
  splitterId,
  currency,
  canAdd,
}: {
  splitterId: string;
  currency: string;
  canAdd: boolean;
}) {
  const { data, loading, error } = useQuery<Data>(SPLITTER_EXPENSES, {
    variables: { id: splitterId },
  });
  if (loading) return <Loading />;
  const splitter = data?.splitter;
  if (error || !splitter) return <p className="text-destructive">Could not load the expenses.</p>;

  const me = splitter.me;
  const expenses = splitter.transactions.filter((t) => t.type === 'expense');
  const myShare = me ? splitter.balances.members.find((b) => b.member.id === me.id)?.share : null;

  const addButton = canAdd && (
    <Link to={`/s/${splitterId}/expenses/new`} className={btn.primary}>
      <Icon name="plus" className="h-4 w-4" />
      Add expense
    </Link>
  );

  if (expenses.length === 0) {
    return (
      <Card>
        <EmptyState icon="🧾" title="No expenses yet" action={addButton}>
          Each person adds what they paid for the group from their own phone.
        </EmptyState>
      </Card>
    );
  }

  const days = new Map<string, Transaction[]>();
  for (const t of expenses) days.set(t.date, [...(days.get(t.date) ?? []), t]);

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-0">
      <div className="grid grid-cols-2 gap-3">
        <Total label="My expenses" amount={myShare ?? 0} currency={currency} />
        <Total
          label="Total expenses"
          amount={splitter.balances.totalExpenses}
          currency={currency}
        />
      </div>

      {[...days].map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <SectionTitle>{formatDay(day)}</SectionTitle>
          <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
            {list.map((t) => (
              <ExpenseRow key={t.id} expense={t} me={me} currency={currency} />
            ))}
          </ul>
        </section>
      ))}

      {/* Floating on a phone, like the add button of an expense app. */}
      {addButton && (
        <Link
          to={`/s/${splitterId}/expenses/new`}
          aria-label="Add expense"
          className="fixed right-5 bottom-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover lg:hidden"
        >
          <Icon name="plus" className="h-6 w-6" />
        </Link>
      )}
      {addButton && <div className="hidden justify-end lg:flex">{addButton}</div>}
    </div>
  );
}

function Total({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <div className={`${cardClass} px-4 py-3`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{formatAmount(amount, currency)}</p>
    </div>
  );
}

function ExpenseRow({
  expense,
  me,
  currency,
}: {
  expense: Transaction;
  me: MemberRef | null;
  currency: string;
}) {
  const payer = expense.paidFromFund
    ? 'the fund'
    : expense.paidBy?.id === me?.id
      ? 'you'
      : (expense.paidBy?.displayName ?? 'someone');
  const participants = expense.split?.participants ?? [];
  const mine = participants.find((p) => p.member.id === me?.id)?.amount;
  const split =
    participants.length === 1
      ? `for ${participants[0].member.id === me?.id ? 'you' : participants[0].member.displayName}`
      : `split ${participants.length} ways`;

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl"
      >
        {emojiOf(expense.category)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{expense.description}</p>
        <p className="truncate text-sm text-muted-foreground">
          Paid by {payer} · {split}
        </p>
        {expense.note && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{expense.note}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums">{formatAmount(expense.amount, currency)}</p>
        {mine !== undefined && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Your part {formatAmount(mine, currency)}
          </p>
        )}
      </div>
    </li>
  );
}
