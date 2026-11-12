import { useState, type FormEvent, type ReactNode } from 'react';
import { currencySymbol } from '@bill-splitter/shared';
import { SPLITTER_TYPE_LABELS, type SplitterType } from '../graphql/splitters';
import { type SplitterFormValues } from '../lib/splitterForm';
import { btn, cardClass, inputClass } from '../lib/styles';
import { SectionTitle, Switch } from './ui';

const EMOJIS = ['🏖️', '⛰️', '✈️', '🏕️', '🎉', '🎂', '🍻', '🍜', '💼', '🏠'];

// The currencies Vietnamese groups travel with most; VND first.
const CURRENCIES = ['VND', 'THB', 'CNY', 'KRW', 'JPY', 'SGD', 'MYR', 'USD', 'EUR'];

/** Shown on the type buttons, and faded in the cover tile until an emoji is picked. */
const TYPE_EMOJI: Record<SplitterType, string> = {
  trip: '🧳',
  party: '🎉',
  project: '💼',
  other: '✨',
};

/** A labelled control inside a grouped card: label on top, control below. */
function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <span className="text-sm font-medium text-foreground/90">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-left">
      <span className="text-sm font-medium text-foreground/90">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

type SplitterFormProps = {
  initial: SplitterFormValues;
  submitLabel: string;
  /** Extra fields for the create form (the admin's name and the starting members). */
  children?: ReactNode;
  /** Whether the currency may still change (it cannot once there are transactions). */
  currencyHint?: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: SplitterFormValues) => void;
};

/** Name, description, type, dates, emoji, currency and fund setting: shared by "create" and "edit". */
export function SplitterForm({
  initial,
  submitLabel,
  children,
  currencyHint,
  submitting,
  error,
  onSubmit,
}: SplitterFormProps) {
  const [values, setValues] = useState(initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const set = <K extends keyof SplitterFormValues>(key: K, value: SplitterFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const currencies = CURRENCIES.includes(values.currency)
    ? CURRENCIES
    : [values.currency, ...CURRENCIES];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return setLocalError('Give the splitter a name');
    if (values.startDate && values.endDate && values.endDate < values.startDate) {
      return setLocalError('The end date is before the start date');
    }
    setLocalError(null);
    onSubmit({ ...values, name: values.name.trim(), description: values.description.trim() });
  };

  const shownError = localError ?? error;
  const chip = (on: boolean) =>
    `rounded-xl border transition-colors ${
      on
        ? 'border-primary bg-primary-soft font-medium text-primary-soft-foreground'
        : 'border-input bg-card hover:bg-muted'
    }`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <SectionTitle>Details</SectionTitle>
        <div className={`${cardClass} flex flex-col gap-4 p-4`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEmojiOpen((o) => !o)}
              aria-expanded={emojiOpen}
              aria-label="Cover emoji"
              title="Cover emoji"
              className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-3xl transition-shadow hover:ring-2 hover:ring-ring/30 ${
                emojiOpen ? 'ring-2 ring-ring/40' : ''
              }`}
            >
              <span className={values.coverEmoji ? '' : 'opacity-40 grayscale'}>
                {values.coverEmoji || TYPE_EMOJI[values.type]}
              </span>
              <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                </svg>
              </span>
            </button>
            <input
              className={`${inputClass} text-lg font-semibold`}
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Name, e.g. Đà Lạt trip 2026"
              aria-label="Name"
              maxLength={100}
              required
            />
          </div>

          {emojiOpen && (
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted p-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    set('coverEmoji', values.coverEmoji === emoji ? '' : emoji);
                    setEmojiOpen(false);
                  }}
                  aria-pressed={values.coverEmoji === emoji}
                  className={`h-11 w-11 text-xl ${chip(values.coverEmoji === emoji)}`}
                >
                  {emoji}
                </button>
              ))}
              <input
                className="h-11 w-16 rounded-xl border border-input bg-card text-center text-xl outline-none focus:border-primary"
                value={EMOJIS.includes(values.coverEmoji) ? '' : values.coverEmoji}
                onChange={(e) => set('coverEmoji', e.target.value.trim())}
                aria-label="Other emoji"
                placeholder="…"
                maxLength={16}
              />
            </div>
          )}

          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Description (optional)"
            aria-label="Description"
            maxLength={1000}
          />

          <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-2">
            {(Object.keys(SPLITTER_TYPE_LABELS) as SplitterType[]).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={values.type === type}
                onClick={() => set('type', type)}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-sm ${chip(values.type === type)}`}
              >
                <span className="text-xl" aria-hidden>
                  {TYPE_EMOJI[type]}
                </span>
                {SPLITTER_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Dates and money</SectionTitle>
        <div className={`${cardClass} divide-y divide-border`}>
          <div className="grid grid-cols-2 gap-3 p-4">
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-foreground/90">Starts</span>
              <input
                type="date"
                className={inputClass}
                value={values.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-foreground/90">Ends</span>
              <input
                type="date"
                className={inputClass}
                value={values.endDate}
                min={values.startDate || undefined}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </label>
          </div>

          <Row
            label="Currency"
            hint={currencyHint ?? 'Every amount in this splitter is in this currency.'}
          >
            <div role="radiogroup" aria-label="Currency" className="flex flex-wrap gap-2">
              {currencies.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={values.currency === code}
                  onClick={() => set('currency', code)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${chip(values.currency === code)}`}
                >
                  <span className="text-muted-foreground">{currencySymbol(code)}</span>
                  {code}
                </button>
              ))}
            </div>
          </Row>

          <div className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground/90">Initial fund</span>
              <span className="block text-xs text-muted-foreground">
                Everyone pays into a shared fund up front, and expenses can be paid from it.
              </span>
            </span>
            <Switch
              label="Initial fund"
              checked={values.hasInitialFund}
              onChange={(on) => set('hasInitialFund', on)}
            />
          </div>
        </div>
      </section>

      {children}

      {/* On a phone the button stays at the bottom of the screen, like an app's main action. */}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 bg-gradient-to-t from-background via-background to-background/0 px-4 pt-6 pb-4 lg:static lg:mx-0 lg:bg-none lg:p-0">
        {shownError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {shownError}
          </p>
        )}
        <button type="submit" disabled={submitting} className={`${btn.primary} w-full py-3`}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
