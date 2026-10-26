/**
 * Turning an Event Manager event into a splitter (DAN-96). Used by the create form, which
 * fills itself in from a picked event, and by the backend, which creates a splitter straight
 * from Event Manager's "Split costs" button.
 */

export type SplitterTypeFromEvent = 'trip' | 'party' | 'project' | 'other';

/** Event Manager icon keys (its backend/src/icons.ts) → a splitter type and cover emoji. */
const FROM_ICON: Record<string, { type: SplitterTypeFromEvent; emoji: string }> = {
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

/** Splitter type and emoji for an event icon; a trip with no emoji when the icon is unknown. */
export function splitterLookFromIcon(icon: string | null | undefined): {
  type: SplitterTypeFromEvent;
  coverEmoji: string;
} {
  const match = icon ? FROM_ICON[icon] : undefined;
  return { type: match?.type ?? 'trip', coverEmoji: match?.emoji ?? '' };
}

/** The event's description with its location under it, cut to the splitter's 1000 characters. */
export function descriptionFromEvent(event: {
  description?: string | null;
  location?: string | null;
}): string {
  return [event.description?.trim(), event.location ? `📍 ${event.location}` : null]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1000);
}

/**
 * The start and end days (YYYY-MM-DD) of an event, given a function that gives the day of an
 * instant in the wanted time zone. An event that ends at midnight ends on the day before.
 */
export function daysFromEvent(
  startTime: string,
  endTime: string,
  dayOf: (date: Date) => string,
): { startDate: string; endDate: string } {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startDate = dayOf(start);
  const endsAtMidnight = end > start && dayOf(new Date(end.getTime() - 1)) !== dayOf(end);
  return { startDate, endDate: dayOf(endsAtMidnight ? new Date(end.getTime() - 1) : end) };
}
