import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "More options" for a form (ecosystem design principles, section 3): only required fields show
 * by default; the optional ones sit behind one toggle, and while it is off the values that will
 * be saved are listed as a line of read-only text. Tapping a value opens the options and focuses
 * that field.
 */

const storageKey = (form: string) => `bs.moreOptions.${form}`;

const readStored = (form: string) => {
  try {
    return localStorage.getItem(storageKey(form)) === '1';
  } catch {
    return false;
  }
};

/** What to focus inside a field's wrapper: the picked radio, else the first control. */
const FOCUSABLE =
  '[aria-checked="true"], input:not([type="hidden"]):not(:disabled), select, textarea, button:not(:disabled)';

export function focusField(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  (target ?? el).focus({ preventScroll: true });
}

/**
 * The toggle's state. It starts off when creating, unless this browser last left it on for this
 * form (a convenience only; no form data is stored), and on when `startOpen` says the object
 * being edited already has optional values, so nothing the user entered is hidden.
 */
export function useMoreOptions(form: string, startOpen = false) {
  const [open, setOpenState] = useState(() => startOpen || readStored(form));
  // The field to focus once the options have rendered; `revealed` makes the effect run again
  // when the options were already open.
  const pendingFocus = useRef<string | null>(null);
  const [revealed, setRevealed] = useState(0);

  /** Flipped by the user: remembered for the next time this form opens. */
  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      try {
        localStorage.setItem(storageKey(form), next ? '1' : '0');
      } catch {
        // Private mode or blocked storage: the toggle still works for this page.
      }
    },
    [form],
  );

  /** Opens the options (not remembered) and focuses the field with this id once it renders. */
  const reveal = useCallback((fieldId: string) => {
    pendingFocus.current = fieldId;
    setOpenState(true);
    setRevealed((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    focusField(pendingFocus.current);
    pendingFocus.current = null;
  }, [open, revealed]);

  return { open, setOpen, reveal };
}

/** One value in the read-only line. `field` is the id of the field it opens; none for fixed values. */
const sameYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const otherYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const localDay = (date: Date) => date.toLocaleDateString('en-CA');

/** "today", "yesterday", "12 Nov" or "30 Dec 2025" for a YYYY-MM-DD day. */
export function dayLabel(day: string): string {
  const now = new Date();
  if (day === localDay(now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDay(yesterday)) return 'yesterday';
  const date = new Date(`${day}T12:00:00`);
  return (date.getFullYear() === now.getFullYear() ? sameYear : otherYear).format(date);
}

/** "12 – 15 Nov", "from 12 Nov", "until 15 Nov" for a pair of optional YYYY-MM-DD days. */
export function daysLabel(start: string, end: string): string | null {
  const toDate = (day: string) => new Date(`${day}T12:00:00`);
  const thisYear = new Date().getFullYear();
  const fmt = (...days: string[]) =>
    days.every((d) => toDate(d).getFullYear() === thisYear) ? sameYear : otherYear;
  if (start && end) return fmt(start, end).formatRange(toDate(start), toDate(end));
  if (start) return `from ${fmt(start).format(toDate(start))}`;
  if (end) return `until ${fmt(end).format(toDate(end))}`;
  return null;
}
