import type { EventManagerEvent, SplitterType } from '../graphql/splitters';
import { emptySplitterForm, type SplitterFormValues } from './splitterForm';

/** Event Manager icon keys (its backend/src/icons.ts) → a splitter type and cover emoji. */
const FROM_ICON: Record<string, { type: SplitterType; emoji: string }> = {
  plane: { type: 'trip', emoji: '✈️' },
  beach: { type: 'trip', emoji: '🏖️' },
  camping: { type: 'trip', emoji: '🏕️' },
  hike: { type: 'trip', emoji: '⛰️' },
  'trail-run': { type: 'trip', emoji: '⛰️' },
  car: { type: 'trip', emoji: '🚗' },
  ski: { type: 'trip', emoji: '⛷️' },
  dive: { type: 'trip', emoji: '🤿' },
  party: { type: 'party', emoji: '🎉' },
  birthday: { type: 'party', emoji: '🎂' },
  food: { type: 'party', emoji: '🍜' },
  coffee: { type: 'party', emoji: '☕' },
  music: { type: 'party', emoji: '🎵' },
  movie: { type: 'party', emoji: '🎬' },
  meeting: { type: 'project', emoji: '💼' },
  work: { type: 'project', emoji: '💼' },
  study: { type: 'project', emoji: '📚' },
};

const pad = (n: number) => String(n).padStart(2, '0');

/** A date-time as YYYY-MM-DD in the browser's time zone. */
function localDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** An event that ends at midnight ends on the day before, not the day it stops at 00:00. */
function endDay(start: Date, end: Date): string {
  const atMidnight = end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0;
  return localDay(atMidnight && end > start ? new Date(end.getTime() - 1) : end);
}

/** Splitter form values copied from an event: title, description, dates, type and emoji. */
export function formFromEvent(event: EventManagerEvent): SplitterFormValues {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const fromIcon = event.icon ? FROM_ICON[event.icon] : undefined;
  return {
    ...emptySplitterForm,
    name: event.title.slice(0, 100),
    description: [event.description?.trim(), event.location ? `📍 ${event.location}` : null]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1000),
    type: fromIcon?.type ?? 'trip',
    coverEmoji: fromIcon?.emoji ?? '',
    startDate: localDay(start),
    endDate: endDay(start, end),
  };
}

/** "24/12/2026" for an event's start, for the picker. */
export function eventDayLabel(event: EventManagerEvent): string {
  const [y, m, d] = localDay(new Date(event.startTime)).split('-');
  return `${d}/${m}/${y}`;
}
