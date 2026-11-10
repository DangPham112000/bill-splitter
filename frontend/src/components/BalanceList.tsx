import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { formatAmount, roundingStepFor } from '@bill-splitter/shared';
import type { Member } from '../graphql/splitters';
import {
  SPLITTER_BALANCES,
  type MemberBalance,
  type MemberRef,
  type Settlement,
} from '../graphql/transactions';
import { cardClass } from '../lib/styles';
import { Avatar, Card, EmptyState, Loading, SectionTitle } from './ui';

type Data = {
  splitter: {
    id: string;
    me: MemberRef | null;
    balances: { fund: number; totalExpenses: number; members: MemberBalance[] };
    settlement: Settlement;
  } | null;
};

const FUND_NAME = 'Initial fund';

/**
 * The Balances tab: who is owed and who owes (DAN-51), then the fewest transfers that settle
 * everyone (DAN-52). Marking a transfer as done comes with the settlement screen (DAN-53).
 */
export function BalanceList({
  splitterId,
  currency,
  members,
}: {
  splitterId: string;
  currency: string;
  members: Member[];
}) {
  const [round, setRound] = useState(false);
  const [viaId, setViaId] = useState<string | null>(null);
  const treasurers = members.filter((m) => m.role === 'treasurer');

  const step = roundingStepFor(currency);

  const { data, previousData, loading, error } = useQuery<Data>(SPLITTER_BALANCES, {
    variables: { id: splitterId, roundTo: round ? step : null, viaMemberId: viaId },
  });
  // Keep the last result on screen while a changed option reloads.
  const shown = data ?? previousData;

  if (loading && !shown) return <Loading />;
  const splitter = shown?.splitter;
  if (error || !splitter) return <p className="text-destructive">Could not load the balances.</p>;

  const { balances, settlement, me } = splitter;
  const nobodyOwes = balances.members.every((b) => b.balance === 0) && balances.fund === 0;
  if (balances.totalExpenses === 0 && nobodyOwes) {
    return (
      <Card>
        <EmptyState icon="🤝" title="Nothing to settle yet">
          Once expenses are added, you will see who is owed and who owes, and the fewest transfers
          to settle up.
        </EmptyState>
      </Card>
    );
  }

  const largest = Math.max(
    1,
    Math.abs(balances.fund),
    ...balances.members.map((b) => Math.abs(b.balance)),
  );
  const name = (m: MemberRef | null) => (m ? (m.id === me?.id ? 'You' : m.displayName) : FUND_NAME);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <SectionTitle>Balances</SectionTitle>
        <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
          {balances.members.map((b) => (
            <BalanceRow
              key={b.member.id}
              name={name(b.member)}
              avatarName={b.member.displayName}
              balance={b.balance}
              largest={largest}
              currency={currency}
              detail={`Paid ${formatAmount(b.paid, currency)} · share ${formatAmount(b.share, currency)}`}
            />
          ))}
          {balances.fund !== 0 && (
            <BalanceRow
              name={FUND_NAME}
              avatarName={FUND_NAME}
              balance={balances.fund}
              largest={largest}
              currency={currency}
              detail={balances.fund < 0 ? 'Money left in the fund' : 'The fund is overspent'}
            />
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>How to settle up</SectionTitle>
        {nobodyOwes ? (
          <Card className="px-4 py-6 text-center text-muted-foreground">Everyone is even. 🎉</Card>
        ) : (
          <>
            <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
              {settlement.transfers.map((t, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-3">
                  <Avatar name={t.from?.displayName ?? FUND_NAME} size="sm" />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{name(t.from)}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      {t.from?.id === me?.id ? 'pay' : 'pays'}{' '}
                    </span>
                    <span className="font-medium">{name(t.to)}</span>
                  </p>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatAmount(t.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-1 text-xs text-muted-foreground">
              {settlement.transfers.length} transfer
              {settlement.transfers.length === 1 ? '' : 's'}
              {viaId
                ? ', all through the treasurer.'
                : settlement.exact
                  ? ', the fewest possible.'
                  : '. The group is large, so this is a close-to-fewest plan.'}
            </p>
          </>
        )}

        {!nobodyOwes && (
          <div className={`${cardClass} flex flex-col divide-y divide-border`}>
            <Toggle
              label={`Round to ${formatAmount(step, currency)}`}
              checked={round}
              onChange={setRound}
            />
            {treasurers.length > 0 && (
              <label className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>Pay through</span>
                <select
                  value={viaId ?? ''}
                  onChange={(e) => setViaId(e.target.value || null)}
                  className="rounded-lg border border-input bg-card px-2 py-1"
                >
                  <option value="">Nobody (fewest transfers)</option>
                  {treasurers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName} (treasurer)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {round && settlement.rounding.length > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            Rounding changes:{' '}
            {settlement.rounding
              .map(
                (r) =>
                  `${name(r.member)} ${r.difference > 0 ? '+' : '−'}${formatAmount(Math.abs(r.difference), currency)}`,
              )
              .join(', ')}
            .
          </p>
        )}
      </section>
    </div>
  );
}

function BalanceRow({
  name,
  avatarName,
  balance,
  largest,
  currency,
  detail,
}: {
  name: string;
  avatarName: string;
  balance: number;
  largest: number;
  currency: string;
  detail: string;
}) {
  const width = `${Math.max(2, (Math.abs(balance) / largest) * 100)}%`;
  const tone =
    balance > 0 ? 'text-success' : balance < 0 ? 'text-destructive' : 'text-muted-foreground';
  return (
    <li className="flex flex-col gap-1.5 px-3 py-3">
      <div className="flex items-center gap-3">
        <Avatar name={avatarName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className={`shrink-0 font-semibold tabular-nums ${tone}`}>
          {balance > 0 ? '+' : ''}
          {formatAmount(balance, currency)}
        </span>
      </div>
      {balance !== 0 && (
        <div className="flex h-1.5 pl-11">
          <div className="flex flex-1 justify-end">
            {balance < 0 && <span className="rounded-full bg-destructive/70" style={{ width }} />}
          </div>
          <div className="flex flex-1">
            {balance > 0 && <span className="rounded-full bg-success/70" style={{ width }} />}
          </div>
        </div>
      )}
    </li>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-primary"
      />
    </label>
  );
}
