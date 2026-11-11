import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  EXPENSE_CATEGORIES,
  formatAmount,
  formatAmountInput,
  parseAmount,
  splitAmount,
  type SplitMethod,
} from '@bill-splitter/shared';
import AmountInput from '../components/AmountInput';
import { Field } from '../components/SplitterForm';
import { Avatar, Card, EmptyState, Icon, Loading, SectionTitle } from '../components/ui';
import { GET_SPLITTER, type Member, type Splitter } from '../graphql/splitters';
import { ADD_EXPENSE, SPLITTER_BALANCES, SPLITTER_EXPENSES } from '../graphql/transactions';
import { btn, cardClass, inputClass } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';

const METHODS: { id: SplitMethod; label: string; hint: string }[] = [
  { id: 'equal', label: 'Equally', hint: 'Everyone ticked pays the same.' },
  { id: 'exact', label: 'Amounts', hint: 'Type what each person owes; it must add up.' },
  { id: 'shares', label: 'Shares', hint: 'E.g. 2 for an adult, 1 for a child.' },
];

/** Today on this device, as YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('en-CA');

export function AddExpensePage() {
  const { id } = useParams();
  const { isLoaded } = useAuthState();
  // Members who joined on this device add expenses signed out (DAN-41).
  const { data, loading } = useQuery<{ splitter: Splitter | null }>(GET_SPLITTER, {
    variables: { id },
    skip: !isLoaded,
  });

  if (!isLoaded || (loading && !data)) return <Loading />;
  const splitter = data?.splitter;
  if (!splitter) {
    return (
      <Card>
        <EmptyState icon="🔍" title="Splitter not found" />
      </Card>
    );
  }
  if (!splitter.me || splitter.status === 'locked') {
    return (
      <Card>
        <EmptyState icon="🔒" title="You can't add expenses here">
          {splitter.status === 'locked'
            ? 'This splitter is locked.'
            : 'Join this splitter with your name first.'}
        </EmptyState>
      </Card>
    );
  }
  return <ExpenseForm splitter={splitter} me={splitter.me} />;
}

/**
 * Amount first with the number keypad, then what it was for and who shares it, so a typical
 * "I paid, split equally" expense is an amount, a few words and one tap.
 */
function ExpenseForm({ splitter, me }: { splitter: Splitter; me: Member }) {
  const navigate = useNavigate();
  const canPickPayer = splitter.myRole === 'admin' || splitter.myRole === 'treasurer';
  const members = splitter.members;

  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [payerId, setPayerId] = useState(me.id);
  const [method, setMethod] = useState<SplitMethod>('equal');
  const [selected, setSelected] = useState(() => new Set(members.map((m) => m.id)));
  const [shares, setShares] = useState<Record<string, number>>({});
  const [exact, setExact] = useState<Record<string, number | null>>({});
  const [error, setError] = useState<string | null>(null);

  const [addExpense, { loading: saving }] = useMutation(ADD_EXPENSE, {
    refetchQueries: [SPLITTER_EXPENSES, SPLITTER_BALANCES],
  });

  const participants = members
    .filter((m) => selected.has(m.id))
    .map((m) => ({
      memberId: m.id,
      shares: method === 'shares' ? (shares[m.id] ?? 1) : null,
      amount: method === 'exact' ? (exact[m.id] ?? null) : null,
    }));

  // Live preview with the same function the server uses, so what you see is what is saved.
  let preview: Map<string, number> | null = null;
  let splitProblem: string | null = null;
  if (!amount) splitProblem = null;
  else if (participants.length === 0) splitProblem = 'Pick at least one person.';
  else if (method !== 'exact') {
    try {
      preview = new Map(
        splitAmount(amount, method, participants, payerId).map((s) => [s.memberId, s.amount]),
      );
    } catch (e) {
      splitProblem = (e as Error).message;
    }
  }
  const exactTotal = participants.reduce((s, p) => s + (p.amount ?? 0), 0);
  const remaining = amount ? amount - exactTotal : 0;

  const toggle = (memberId: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!amount) return setError('Enter the amount.');
    if (!description.trim()) return setError('Say what it was for, e.g. "Lẩu gà lá é".');
    if (participants.length === 0) return setError('Pick at least one person to split with.');
    if (method === 'exact' && remaining !== 0) {
      return setError(
        remaining > 0
          ? `${formatAmount(remaining, splitter.currency)} still has to be given to someone.`
          : `The amounts are ${formatAmount(-remaining, splitter.currency)} over the total.`,
      );
    }
    if (splitProblem) return setError(splitProblem);
    try {
      await addExpense({
        variables: {
          splitterId: splitter.id,
          input: {
            amount,
            description: description.trim(),
            date,
            category,
            note: note.trim() || null,
            paidByMemberId: payerId,
            split: { method, participants },
          },
        },
      });
      navigate(`/s/${splitter.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-24">
      <div className="flex items-center gap-1">
        <Link to={`/s/${splitter.id}`} aria-label="Back" className={`${btn.icon} -ml-2`}>
          <Icon name="back" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New expense</h1>
        <span className="ml-auto truncate text-sm text-muted-foreground">{splitter.name}</span>
      </div>

      <div className={`${cardClass} p-4`}>
        <AmountInput
          value={amount}
          onChange={setAmount}
          currency={splitter.currency}
          label="How much?"
          autoFocus
        />
      </div>

      <Field label="What for?">
        <input
          className={inputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Lẩu gà lá é"
          maxLength={200}
          enterKeyHint="next"
        />
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(category === c.id ? null : c.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              category === c.id
                ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                : 'border-input bg-card hover:bg-muted'
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Paid by">
          {canPickPayer ? (
            <select
              className={inputClass}
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me.id ? `${m.displayName} (you)` : m.displayName}
                </option>
              ))}
            </select>
          ) : (
            <span className={`${inputClass} truncate`}>{me.displayName} (you)</span>
          )}
        </Field>
        <Field label="Date">
          <input
            type="date"
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value || today())}
          />
        </Field>
      </div>

      <section className="flex flex-col gap-2">
        <SectionTitle
          action={
            <div className="flex gap-1">
              <button
                type="button"
                className={btn.small}
                onClick={() => setSelected(new Set(members.map((m) => m.id)))}
              >
                All
              </button>
              <button type="button" className={btn.small} onClick={() => setSelected(new Set())}>
                None
              </button>
            </div>
          }
        >
          Split between ({participants.length})
        </SectionTitle>

        <div className="flex rounded-xl bg-muted p-1" role="radiogroup" aria-label="Split method">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={method === m.id}
              onClick={() => setMethod(m.id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                method === m.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          {METHODS.find((m) => m.id === method)!.hint}
        </p>

        <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
          {members.map((member) => {
            const on = selected.has(member.id);
            return (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(member.id)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <Avatar name={member.displayName} size="sm" />
                  <span className={`truncate ${on ? '' : 'text-muted-foreground'}`}>
                    {member.displayName}
                    {member.id === me.id && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                </label>
                {on && method === 'shares' && (
                  <Stepper
                    value={shares[member.id] ?? 1}
                    onChange={(n) => setShares((s) => ({ ...s, [member.id]: n }))}
                  />
                )}
                {on && method === 'exact' ? (
                  <MiniAmountInput
                    currency={splitter.currency}
                    value={exact[member.id] ?? null}
                    onChange={(n) => setExact((s) => ({ ...s, [member.id]: n }))}
                    label={`Amount for ${member.displayName}`}
                  />
                ) : (
                  <span className="w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {on && preview?.has(member.id)
                      ? formatAmount(preview.get(member.id)!, splitter.currency)
                      : ''}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {method === 'exact' && amount ? (
          <p
            className={`px-1 text-sm ${remaining === 0 ? 'text-success' : 'text-warning'}`}
            aria-live="polite"
          >
            {remaining === 0
              ? 'Adds up to the total.'
              : remaining > 0
                ? `${formatAmount(remaining, splitter.currency)} left to assign`
                : `${formatAmount(-remaining, splitter.currency)} over the total`}
          </p>
        ) : null}
      </section>

      {showNote ? (
        <Field label="Note">
          <textarea
            className={`${inputClass} min-h-20`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="What was on the bill, who forgot their wallet…"
          />
        </Field>
      ) : (
        <button
          type="button"
          className={`${btn.ghost} self-start`}
          onClick={() => setShowNote(true)}
        >
          <Icon name="plus" className="h-4 w-4" />
          Add a note
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Stays in reach of the thumb on a phone. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <button type="submit" disabled={saving} className={`${btn.primary} w-full py-3 text-base`}>
          {saving ? 'Saving…' : amount ? `Add ${formatAmount(amount, splitter.currency)}` : 'Add'}
        </button>
      </div>
    </form>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="One share less"
        className={btn.small}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="w-6 text-center tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="One share more"
        className={btn.small}
        onClick={() => onChange(Math.min(value + 1, 99))}
      >
        +
      </button>
    </div>
  );
}

/** A compact amount field for one person's part in an "amounts" split. */
function MiniAmountInput({
  value,
  onChange,
  currency,
  label,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  currency: string;
  label: string;
}) {
  const [text, setText] = useState(() =>
    value === null ? '' : formatAmount(value, currency, { symbol: false }),
  );
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder="0"
      value={text}
      onChange={(e) => {
        const next = formatAmountInput(e.target.value, currency);
        setText(next);
        onChange(parseAmount(next, currency));
      }}
      className="w-28 shrink-0 rounded-lg border border-input bg-card px-2 py-1.5 text-right tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
    />
  );
}
