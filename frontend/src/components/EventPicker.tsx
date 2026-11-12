import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { nameMatches, splitterLookFromIcon } from '@bill-splitter/shared';
import type { EventManagerEvent } from '../graphql/splitters';
import { eventDayLabel, eventDaysLabel } from '../lib/eventPrefill';
import { useIsDesktop } from '../lib/useIsDesktop';
import { Icon } from './ui';

type Props = {
  events: EventManagerEvent[] | undefined;
  loading: boolean;
  failed: boolean;
  value: string;
  onChange: (eventId: string) => void;
};

/** One row of the list: "no event" or an event, with the section it is shown under. */
type Option = {
  key: string;
  event: EventManagerEvent | null;
  section: 'none' | 'upcoming' | 'past';
};

const emojiFor = (event: EventManagerEvent) => splitterLookFromIcon(event.icon).coverEmoji || '📅';

/** Title, place and day, so "dalat", "vung tau" or "24/12" all find an event. */
const matches = (event: EventManagerEvent, query: string) =>
  nameMatches(`${event.title} ${event.location ?? ''} ${eventDayLabel(event)}`, query);

/**
 * Picks an Event Manager event to start a splitter from. A searchable list with upcoming events
 * (soonest first) above past ones (latest first): a popover on desktop, a bottom sheet on a phone.
 */
export function EventPicker({ events, loading, failed, value, onChange }: Props) {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Fixed when the page opens, so an event does not jump between sections while picking.
  const [now] = useState(() => Date.now());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = events?.find((e) => e.id === value) ?? null;
  const disabled = loading || failed || !events?.length;

  const { upcoming, past } = useMemo(() => {
    const all = events ?? [];
    const time = (iso: string) => new Date(iso).getTime();
    return {
      upcoming: all
        .filter((e) => time(e.endTime) >= now)
        .sort((a, b) => time(a.startTime) - time(b.startTime)),
      past: all
        .filter((e) => time(e.endTime) < now)
        .sort((a, b) => time(b.startTime) - time(a.startTime)),
    };
  }, [events, now]);

  const options = useMemo<Option[]>(() => {
    const q = query.trim();
    const list: Option[] = q ? [] : [{ key: 'none', event: null, section: 'none' }];
    for (const event of upcoming)
      if (matches(event, q)) list.push({ key: event.id, event, section: 'upcoming' });
    for (const event of past)
      if (matches(event, q)) list.push({ key: event.id, event, section: 'past' });
    return list;
  }, [query, upcoming, past]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    // The list opens unfiltered, with "No event" first and the picked event highlighted.
    setActive(value ? 1 + [...upcoming, ...past].findIndex((e) => e.id === value) : 0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const pick = (option: Option | undefined) => {
    if (!option) return;
    onChange(option.event?.id ?? '');
    close();
  };

  // A phone keyboard would cover half the sheet, so only focus the search box on desktop.
  useEffect(() => {
    if (open && isDesktop) searchRef.current?.focus();
  }, [open, isDesktop]);

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  let hint = 'Fills in the name, dates, description and people from the event.';
  if (loading) hint = 'Loading your events…';
  else if (failed)
    hint = 'Event Manager cannot be reached right now. You can still fill the form in.';
  else if (!events?.length) hint = 'You have no events in Event Manager yet.';

  const panel = (
    <div
      className={
        isDesktop
          ? 'absolute inset-x-0 top-full z-40 mt-2 flex max-h-[min(30rem,65vh)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl'
          : 'fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl'
      }
      onKeyDown={onListKey}
      role="dialog"
      aria-modal={!isDesktop}
      aria-label="Pick an event"
    >
      {!isDesktop && (
        <div className="flex items-center justify-between px-4 pt-2">
          <span className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
          <h2 className="pt-3 text-lg font-semibold">Pick an event</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="mt-2 -mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 focus-within:ring-2 focus-within:ring-ring/30">
          <Icon name="search" className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search by name, place or date"
            className="w-full bg-transparent py-2.5 text-[16px] outline-none placeholder:text-muted-foreground/80 lg:text-sm"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        className="overflow-y-auto overscroll-contain p-1.5"
      >
        {options.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No events match “{query.trim()}”.
          </li>
        )}
        {options.map((option, index) => {
          const firstOfSection = index === 0 || options[index - 1].section !== option.section;
          return (
            <PickerRow
              key={option.key}
              id={`${listId}-${index}`}
              index={index}
              heading={
                firstOfSection && option.section !== 'none'
                  ? `${option.section === 'upcoming' ? 'Upcoming' : 'Past'} · ${
                      options.filter((o) => o.section === option.section).length
                    }`
                  : undefined
              }
              option={option}
              now={now}
              selected={option.key === (value || 'none')}
              active={index === active}
              onHover={() => setActive(index)}
              onPick={() => pick(option)}
            />
          );
        })}
      </ul>
    </div>
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Start from an event <span className="font-normal normal-case">(optional)</span>
        </h2>
      </div>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? close() : openList())}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault();
              openList();
            }
          }}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-default disabled:opacity-70 ${
            selected
              ? 'border-primary/40 bg-primary-soft'
              : 'border-dashed border-primary/40 bg-primary-soft/60 hover:bg-primary-soft'
          } ${open ? 'ring-2 ring-ring/30' : ''}`}
        >
          {selected ? (
            <>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-2xl">
                {emojiFor(selected)}
              </span>
              <span className="min-w-0 flex-1 pr-8">
                <span className="block truncate font-semibold">{selected.title}</span>
                <EventMeta event={selected} />
              </span>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Icon name="calendar" className="h-6 w-6" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {disabled ? 'Event Manager' : 'Pick an Event Manager event'}
                </span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              {!disabled && (
                <Icon name="chevron-down" className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
            </>
          )}
        </button>
        {selected && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Don't use an event"
            title="Don't use an event"
            className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        )}
        {open && isDesktop && (
          <>
            {/* Clicking anywhere else closes the list. */}
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
            {panel}
          </>
        )}
      </div>
      {selected && (
        <p className="px-1 text-xs text-muted-foreground">
          The details and people below come from this event. You can still change them.
        </p>
      )}
      {open &&
        !isDesktop &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50 bg-overlay" onClick={close} aria-hidden />
            {panel}
          </>,
          document.body,
        )}
    </section>
  );
}

function PickerRow({
  id,
  index,
  heading,
  option,
  now,
  selected,
  active,
  onHover,
  onPick,
}: {
  id: string;
  index: number;
  heading?: string;
  option: Option;
  now: number;
  selected: boolean;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const { event } = option;
  const happeningNow =
    event && new Date(event.startTime).getTime() <= now && new Date(event.endTime).getTime() >= now;

  return (
    <>
      {heading && (
        <li
          role="presentation"
          className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {heading}
        </li>
      )}
      <li
        id={id}
        data-index={index}
        role="option"
        aria-selected={selected}
        onMouseMove={onHover}
        onClick={onPick}
        className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${
          active ? 'bg-muted' : ''
        } ${event && option.section === 'past' ? 'opacity-80' : ''}`}
      >
        {event ? (
          <>
            <Tile>{emojiFor(event)}</Tile>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{event.title}</span>
                {happeningNow && (
                  <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                    Now
                  </span>
                )}
              </span>
              <EventMeta event={event} />
            </span>
          </>
        ) : (
          <>
            <Tile>
              <Icon name="edit" className="h-5 w-5 text-muted-foreground" />
            </Tile>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">No event</span>
              <span className="block text-sm text-muted-foreground">Fill the form in yourself</span>
            </span>
          </>
        )}
        <span className="w-5 shrink-0 text-primary">
          {selected && <Icon name="check" className="h-5 w-5" />}
        </span>
      </li>
    </>
  );
}

function Tile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xl">
      {children}
    </span>
  );
}

/** "20 – 23 Dec 2026 · Đà Lạt · 5 people" under an event's title. */
function EventMeta({ event }: { event: EventManagerEvent }) {
  const parts = [
    eventDaysLabel(event),
    event.location,
    `${event.attendees.length} ${event.attendees.length === 1 ? 'person' : 'people'}`,
  ];
  return (
    <span className="block truncate text-sm text-muted-foreground">
      {parts.filter(Boolean).join(' · ')}
    </span>
  );
}
