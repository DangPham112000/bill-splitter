import { useId, useRef, useState, type ChangeEvent } from 'react';
import {
  DEFAULT_CURRENCY,
  currencyDecimals,
  currencySymbol,
  formatAmount,
  formatAmountInput,
  isShorthandAmount,
  parseAmount,
  quickAddAmounts,
} from '@bill-splitter/shared';

type AmountInputProps = {
  /** Integer amount in the currency's minor unit, or null while empty or invalid. */
  value: number | null;
  onChange: (value: number | null) => void;
  currency?: string;
  label?: string;
  /** Show the +10k / +50k / +100k / +500k chips. */
  quickAdd?: boolean;
  autoFocus?: boolean;
};

const plain = (amount: number | null, currency: string) =>
  amount === null ? '' : formatAmount(amount, currency, { symbol: false });

/** Digits and the decimal comma are what the caret position is anchored to while regrouping. */
const countSignificant = (text: string) => text.replace(/[^\d,]/g, '').length;

function caretAfterSignificant(text: string, count: number): number {
  if (count === 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/[\d,]/.test(text[i]) && ++seen === count) return i + 1;
  }
  return text.length;
}

/**
 * Amount field that reads and writes the Vietnamese way: live "1.250.000" grouping, shorthands such
 * as "50k" or "1.2tr", and quick-add chips. Opens the numeric keypad on phones; the "abc" button
 * switches to the letter keyboard for typing shorthands.
 */
export default function AmountInput({
  value,
  onChange,
  currency = DEFAULT_CURRENCY,
  label = 'Amount',
  quickAdd = true,
  autoFocus,
}: AmountInputProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => plain(value, currency));
  const [lastValue, setLastValue] = useState(value);
  const [letters, setLetters] = useState(false);
  const [touched, setTouched] = useState(false);
  // Set once someone types their own separator in a currency without decimals ("1.2" on the way
  // to "1.2tr"): regrouping would swallow that dot, so live formatting pauses until blur.
  const [rawTyping, setRawTyping] = useState(false);

  // Follow changes made by the parent (a reset, a loaded transaction) without fighting the typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseAmount(text, currency) !== value) setText(plain(value, currency));
  }

  const update = (nextText: string) => {
    const amount = parseAmount(nextText, currency);
    setText(nextText);
    setLastValue(amount);
    if (amount !== value) onChange(amount);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    let raw = input.value;
    let caret = input.selectionStart ?? raw.length;
    const typed = raw.length === text.length + 1 ? raw[caret - 1] : null;
    const decimals = currencyDecimals(currency);
    if (raw.trim() === '') {
      setRawTyping(false);
      update('');
      return;
    }
    if (rawTyping || (decimals === 0 && (typed === '.' || typed === ','))) {
      setRawTyping(true);
      update(raw);
      return;
    }
    // Phone keypads often only have a dot; in a currency with decimals, a dot typed before any
    // comma is meant as the decimal mark.
    if (decimals > 0 && typed === '.' && !text.includes(',')) {
      raw = `${raw.slice(0, caret - 1)},${raw.slice(caret)}`;
    }
    const formatted = formatAmountInput(raw, currency);
    if (formatted !== raw) {
      caret = caretAfterSignificant(formatted, countSignificant(raw.slice(0, caret)));
      requestAnimationFrame(() => inputRef.current?.setSelectionRange(caret, caret));
    }
    update(formatted);
  };

  const handleBlur = () => {
    setTouched(true);
    setRawTyping(false);
    const amount = parseAmount(text, currency);
    if (amount !== null) setText(plain(amount, currency));
  };

  const addQuick = (amount: number) => {
    const next = (parseAmount(text, currency) ?? 0) + amount;
    update(plain(next, currency));
    setTouched(false);
    setRawTyping(false);
  };

  const parsed = parseAmount(text, currency);
  const invalid = text.trim() !== '' && parsed === null;
  const showError = invalid && touched;
  const hint =
    parsed !== null && isShorthandAmount(text) ? `= ${formatAmount(parsed, currency)}` : null;
  const example = currency === 'VND' ? '50.000, 50k or 1.2tr' : '120,50 or 1k';

  return (
    <div className="flex flex-col gap-2 text-left">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className={`flex items-center rounded-lg border bg-white px-3 focus-within:ring-2 ${
          showError
            ? 'border-red-400 focus-within:ring-red-200'
            : 'border-slate-300 focus-within:ring-sky-200'
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode={letters ? 'text' : 'decimal'}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="0"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={showError}
          aria-describedby={`${id}-help`}
          className="min-w-0 flex-1 bg-transparent py-3 text-right text-xl font-semibold tabular-nums outline-none"
        />
        <span className="pl-2 text-lg text-slate-500">{currencySymbol(currency)}</span>
        <button
          type="button"
          onClick={() => {
            setLetters(!letters);
            inputRef.current?.focus();
          }}
          className="ml-2 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100"
          aria-label={letters ? 'Use number keypad' : 'Use letter keyboard for shorthands'}
        >
          {letters ? '123' : 'abc'}
        </button>
      </div>
      <p
        id={`${id}-help`}
        className={`min-h-5 text-sm ${showError ? 'text-red-600' : 'text-slate-500'}`}
      >
        {showError ? `Enter an amount like ${example}` : hint}
      </p>
      {quickAdd && (
        <div className="flex flex-wrap gap-2">
          {quickAddAmounts(currency).map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => addQuick(chip.amount)}
              className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 active:bg-slate-200"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
