import { useState, type FormEvent, type ReactNode } from 'react';
import { SPLITTER_TYPE_LABELS, type SplitterType } from '../graphql/splitters';
import { inputClass, type SplitterFormValues } from '../lib/splitterForm';

const EMOJIS = ['🏖️', '⛰️', '✈️', '🏕️', '🎉', '🎂', '🍻', '🍜', '💼', '🏠'];

// The currencies Vietnamese groups travel with most; VND first.
const CURRENCIES = ['VND', 'THB', 'CNY', 'KRW', 'JPY', 'SGD', 'MYR', 'USD', 'EUR'];

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
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Name">
        <input
          className={inputClass}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Đà Lạt trip 2026"
          maxLength={100}
          autoFocus
          required
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          className={`${inputClass} min-h-20`}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={1000}
        />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Type</legend>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(SPLITTER_TYPE_LABELS) as SplitterType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set('type', type)}
              aria-pressed={values.type === type}
              className={`rounded-lg border px-2 py-2 text-sm ${
                values.type === type
                  ? 'border-sky-600 bg-sky-50 font-medium text-sky-700'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {SPLITTER_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-slate-700">
          Cover emoji (optional)
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => set('coverEmoji', values.coverEmoji === emoji ? '' : emoji)}
              aria-pressed={values.coverEmoji === emoji}
              className={`h-10 w-10 rounded-lg border text-xl ${
                values.coverEmoji === emoji ? 'border-sky-600 bg-sky-50' : 'border-slate-200'
              }`}
            >
              {emoji}
            </button>
          ))}
          <input
            className="h-10 w-16 rounded-lg border border-slate-300 text-center text-xl"
            value={EMOJIS.includes(values.coverEmoji) ? '' : values.coverEmoji}
            onChange={(e) => set('coverEmoji', e.target.value.trim())}
            aria-label="Other emoji"
            placeholder="…"
            maxLength={16}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date (optional)">
          <input
            type="date"
            className={inputClass}
            value={values.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
        </Field>
        <Field label="End date (optional)">
          <input
            type="date"
            className={inputClass}
            value={values.endDate}
            min={values.startDate || undefined}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Currency"
        hint={currencyHint ?? 'Every amount in this splitter is in this currency.'}
      >
        <select
          className={inputClass}
          value={values.currency}
          onChange={(e) => set('currency', e.target.value)}
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-left">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={values.hasInitialFund}
          onChange={(e) => set('hasInitialFund', e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-slate-700">Initial fund</span>
          <span className="block text-xs text-slate-500">
            Everyone pays into a shared fund up front, and expenses can be paid from it.
          </span>
        </span>
      </label>

      {children}

      {shownError && <p className="text-sm text-red-600">{shownError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
