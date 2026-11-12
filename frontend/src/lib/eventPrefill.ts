import { daysFromEvent, descriptionFromEvent, splitterLookFromIcon } from '@bill-splitter/shared';
import type { EventManagerEvent } from '../graphql/splitters';
import { emptySplitterForm, type SplitterFormValues } from './splitterForm';

const pad = (n: number) => String(n).padStart(2, '0');

/** A date-time as YYYY-MM-DD in the browser's time zone. */
const localDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Splitter form values copied from an event: title, description, dates, type and emoji. */
export function formFromEvent(event: EventManagerEvent): SplitterFormValues {
  return {
    ...emptySplitterForm,
    name: event.title.slice(0, 100),
    description: descriptionFromEvent(event),
    ...splitterLookFromIcon(event.icon),
    ...daysFromEvent(event.startTime, event.endTime, localDay),
  };
}

/** "24/12/2026" for an event's start, for the picker. */
export function eventDayLabel(event: EventManagerEvent): string {
  const [y, m, d] = localDay(new Date(event.startTime)).split('-');
  return `${d}/${m}/${y}`;
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** "20 – 23 Dec 2026", "24 Dec" (this year) or "30 Dec 2026 – 2 Jan 2027" for an event's days. */
export function eventDaysLabel(event: EventManagerEvent): string {
  const { startDate, endDate } = daysFromEvent(event.startTime, event.endTime, localDay);
  const toDate = (day: string) => new Date(`${day}T12:00:00`);
  const start = toDate(startDate);
  const end = toDate(endDate || startDate);
  const thisYear = start.getFullYear() === new Date().getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  const format = thisYear && sameYear ? dayMonth : dayMonthYear;
  return format.formatRange(start, end);
}
