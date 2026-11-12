import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cleanName, normalizeName } from '@bill-splitter/shared';
import { cardClass } from '../lib/styles';
import { DisabledReason } from './DisabledReason';
import { Avatar, Icon, SectionTitle } from './ui';

/** An attendee of the picked Event Manager event, offered as a member tied to their account. */
export type LinkedRow = { clerkId: string; name: string; interested: boolean; include: boolean };

type Props = {
  adminName: string;
  onAdminName: (name: string) => void;
  eventRows: LinkedRow[];
  onEventRow: (index: number, change: Partial<LinkedRow>) => void;
  names: string[];
  onNames: (names: string[]) => void;
};

const rowInput =
  'w-full min-w-0 rounded-lg bg-transparent px-2 py-1.5 -mx-2 font-medium outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground/70 hover:bg-muted focus:bg-muted disabled:hover:bg-transparent';

/** "Minh, Lan\nTuấn" → ["Minh", "Lan", "Tuấn"]: pasting a list from a chat adds everyone. */
const splitNames = (text: string) =>
  text
    .split(/[\n,;]+/)
    .map(cleanName)
    .filter(Boolean);

/**
 * Everyone in the new splitter, as a list like a group chat's member list: the admin first, then
 * the people from the picked event (each can be left out), then names added by hand.
 */
export function ParticipantsEditor({
  adminName,
  onAdminName,
  eventRows,
  onEventRow,
  names,
  onNames,
}: Props) {
  const [draft, setDraft] = useState('');

  // The first row with a name is the one kept; later rows with the same name get a warning.
  const all = [
    { key: 'admin', name: adminName },
    ...eventRows.map((row) => ({ key: `event-${row.clerkId}`, name: row.include ? row.name : '' })),
    ...names.map((name, i) => ({ key: `name-${i}`, name })),
  ];
  const clashes = new Map<string, string>();
  const seen = new Map<string, string>();
  for (const { key, name } of all) {
    const norm = normalizeName(name);
    if (!norm) continue;
    if (seen.has(norm)) clashes.set(key, seen.get(norm)!);
    else seen.set(norm, cleanName(name));
  }
  const count = all.filter(({ name }) => normalizeName(name)).length;

  const add = (text: string) => {
    const added = splitNames(text);
    if (added.length) onNames([...names, ...added]);
    setDraft('');
  };

  const onDraftKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Enter adds the name rather than submitting the whole form.
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && names.length) {
      onNames(names.slice(0, -1));
    }
  };

  const onDraftPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[\n,;]/.test(text)) {
      e.preventDefault();
      add(`${draft}${text}`);
    }
  };

  const clash = (key: string) =>
    clashes.has(key) && (
      <span className="block text-xs text-destructive">Same name as “{clashes.get(key)}”</span>
    );

  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Participants · {count}</SectionTitle>
      <ul className={`${cardClass} divide-y divide-border`}>
        <li className="flex items-center gap-3 px-4 py-2.5">
          <Avatar name={adminName || '?'} size="sm" />
          <span className="min-w-0 flex-1">
            <input
              className={rowInput}
              value={adminName}
              onChange={(e) => onAdminName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name in this splitter"
              maxLength={50}
              required
            />
            {clash('admin')}
          </span>
          <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground">
            You · Admin
          </span>
        </li>

        {eventRows.map((row, index) => (
          <li key={row.clerkId} className="flex items-center gap-3 px-4 py-2.5">
            {/* Faded when left out; not the whole row, which would fade the tooltip too. */}
            <span className={`transition-opacity ${row.include ? '' : 'opacity-55'}`}>
              <Avatar name={row.name || '?'} size="sm" />
            </span>
            <span className="min-w-0 flex-1">
              <DisabledReason
                className="flex w-full"
                reason={
                  !row.include &&
                  `${row.name || 'This person'} is left out. Tick them on the right to add them and edit their name.`
                }
              >
                <input
                  className={`${rowInput} disabled:opacity-55`}
                  value={row.name}
                  onChange={(e) => onEventRow(index, { name: e.target.value })}
                  aria-label={`Name for ${row.name}`}
                  maxLength={50}
                  disabled={!row.include}
                />
              </DisabledReason>
              {clash(`event-${row.clerkId}`)}
            </span>
            {row.interested && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Interested
              </span>
            )}
            <button
              type="button"
              role="checkbox"
              aria-checked={row.include}
              aria-label={`Add ${row.name}`}
              onClick={() => onEventRow(index, { include: !row.include })}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                row.include
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card'
              }`}
            >
              {row.include && <Icon name="check" className="h-3.5 w-3.5" />}
            </button>
          </li>
        ))}

        {names.map((name, index) => (
          <li key={index} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar name={name || '?'} size="sm" />
            <span className="min-w-0 flex-1">
              <input
                className={rowInput}
                value={name}
                onChange={(e) => onNames(names.map((n, i) => (i === index ? e.target.value : n)))}
                onBlur={() => !cleanName(name) && onNames(names.filter((_, i) => i !== index))}
                aria-label={`Name ${index + 1}`}
                maxLength={50}
              />
              {clash(`name-${index}`)}
            </span>
            <button
              type="button"
              onClick={() => onNames(names.filter((_, i) => i !== index))}
              aria-label={`Remove ${name}`}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </li>
        ))}

        <li className="flex items-center gap-3 px-4 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-input text-muted-foreground">
            <Icon name="plus" className="h-4 w-4" />
          </span>
          <input
            className={`${rowInput} flex-1`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKey}
            onPaste={onDraftPaste}
            onBlur={() => add(draft)}
            placeholder="Add a participant"
            aria-label="Add a participant"
            maxLength={50}
            enterKeyHint="done"
          />
          {draft.trim() && (
            <button
              type="button"
              // Keeps the input focused, so several names can be typed in a row.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(draft)}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              Add
            </button>
          )}
        </li>
      </ul>
      <p className="px-1 text-xs text-muted-foreground">
        {eventRows.length > 0 &&
          'People from the event are tied to their accounts, so the splitter shows up in their list. '}
        Anyone can also join through the invite link later and add their own name.
      </p>
    </section>
  );
}
