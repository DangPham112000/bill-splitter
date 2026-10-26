import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  CREATE_SPLITTER,
  EVENT_MANAGER_EVENTS,
  MY_SPLITTERS,
  type EventManagerEvent,
  type Splitter,
} from '../graphql/splitters';
import { Field, SplitterForm } from '../components/SplitterForm';
import { emptySplitterForm, inputClass, type SplitterFormValues } from '../lib/splitterForm';
import { SignInPrompt } from '../components/SignInPrompt';
import { useAuthState } from '../lib/useAuthState';
import { eventDayLabel, formFromEvent } from '../lib/eventPrefill';

const ME_NAME = gql`
  query MeName {
    me {
      clerkId
      name
    }
  }
`;

/** An attendee of the picked event, offered as a starting member tied to their account. */
type LinkedRow = { clerkId: string; name: string; interested: boolean; include: boolean };

/** Everyone but the admin; people only "interested" start unticked. */
const rowsFromEvent = (event: EventManagerEvent): LinkedRow[] =>
  event.attendees
    .filter((a) => !a.isMe)
    .map((a) => ({
      clerkId: a.clerkId,
      name: a.name,
      interested: a.participation === 'INTERESTED',
      include: a.participation === 'JOINED',
    }));

/** "Phạm Đăng" → one name per line, empty lines dropped. */
const parseNames = (text: string) =>
  text
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);

export function CreateSplitterPage() {
  const { isLoaded, isSignedIn } = useAuthState();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="pt-6">
        <SignInPrompt message="Sign in to create a splitter. The people who join through your link do not need an account." />
      </div>
    );
  }
  return <CreateSplitterForm />;
}

function CreateSplitterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // ?event=<id> picks an Event Manager event up front (a link from Event Manager can use it).
  const [eventId, setEventId] = useState(searchParams.get('event') ?? '');
  // Edits to each event's attendee list, kept if the user switches events and back.
  const [rowEdits, setRowEdits] = useState<Record<string, LinkedRow[]>>({});
  const events = useQuery<{ eventManagerEvents: EventManagerEvent[] }>(EVENT_MANAGER_EVENTS);
  const event = events.data?.eventManagerEvents.find((e) => e.id === eventId) ?? null;
  const rows = event ? (rowEdits[event.id] ?? rowsFromEvent(event)) : [];
  const setRow = (index: number, change: Partial<LinkedRow>) =>
    event &&
    setRowEdits((edits) => ({
      ...edits,
      [event.id]: rows.map((row, i) => (i === index ? { ...row, ...change } : row)),
    }));
  const linkedMembers = rows
    .filter((row) => row.include && row.name.trim())
    .map((row) => ({ name: row.name.trim(), clerkId: row.clerkId }));

  const { data: me } = useQuery<{ me: { name: string | null } | null }>(ME_NAME);
  // null until edited, so the account name can fill it in once it loads.
  const [adminName, setAdminName] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createSplitter, { loading }] = useMutation<{ createSplitter: Splitter }>(CREATE_SPLITTER, {
    refetchQueries: [MY_SPLITTERS],
  });

  const shownAdminName = adminName ?? me?.me?.name ?? '';
  const memberCount = parseNames(memberNames).length;
  const initial = event ? formFromEvent(event) : emptySplitterForm;

  const submit = async (values: SplitterFormValues) => {
    if (!shownAdminName.trim()) return setError('Enter your name in this splitter');
    setError(null);
    try {
      const { data } = await createSplitter({
        variables: {
          input: {
            name: values.name,
            description: values.description || null,
            type: values.type,
            coverEmoji: values.coverEmoji || null,
            startDate: values.startDate || null,
            endDate: values.endDate || null,
            currency: values.currency,
            hasInitialFund: values.hasInitialFund,
            adminName: shownAdminName.trim(),
            memberNames: parseNames(memberNames),
            eventManagerEventId: event?.id ?? null,
            linkedMembers,
          },
        },
      });
      if (data) navigate(`/s/${data.createSplitter.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-semibold">New splitter</h1>
      <EventPicker
        events={events.data?.eventManagerEvents}
        loading={events.loading}
        failed={Boolean(events.error)}
        value={event?.id ?? ''}
        onChange={setEventId}
      />
      <SplitterForm
        // Picking another event starts the form again from that event's details.
        key={event?.id ?? 'blank'}
        initial={initial}
        submitLabel="Create splitter"
        submitting={loading}
        error={error}
        onSubmit={submit}
      >
        <Field label="Your name in this splitter" hint="You will be its admin.">
          <input
            className={inputClass}
            value={shownAdminName}
            onChange={(e) => setAdminName(e.target.value)}
            maxLength={50}
            required
          />
        </Field>
        {event && rows.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-slate-700">
              People from the event ({linkedMembers.length})
            </legend>
            <ul className="flex flex-col gap-2">
              {rows.map((row, index) => (
                <li key={row.clerkId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={row.include}
                    onChange={(e) => setRow(index, { include: e.target.checked })}
                    aria-label={`Add ${row.name}`}
                  />
                  <input
                    className={`${inputClass} py-1.5`}
                    value={row.name}
                    onChange={(e) => setRow(index, { name: e.target.value })}
                    maxLength={50}
                    disabled={!row.include}
                  />
                  {row.interested && (
                    <span className="shrink-0 text-xs text-slate-500">Interested</span>
                  )}
                </li>
              ))}
            </ul>
            <span className="text-xs text-slate-500">
              Their names are tied to their accounts, so the splitter shows up in their list when
              they sign in.
            </span>
          </fieldset>
        )}
        <Field
          label={`Other members (optional${memberCount ? `, ${memberCount}` : ''})`}
          hint="One name per line. People pick their name when they join, and can still add a new one."
        >
          <textarea
            className={`${inputClass} min-h-28`}
            value={memberNames}
            onChange={(e) => setMemberNames(e.target.value)}
            placeholder={'Minh\nLan\nTuấn'}
          />
        </Field>
      </SplitterForm>
    </div>
  );
}

function EventPicker({
  events,
  loading,
  failed,
  value,
  onChange,
}: {
  events: EventManagerEvent[] | undefined;
  loading: boolean;
  failed: boolean;
  value: string;
  onChange: (eventId: string) => void;
}) {
  let hint = 'Fills in the name, description, dates and people from the event.';
  if (loading) hint = 'Loading your events…';
  else if (failed)
    hint = 'Event Manager cannot be reached right now. You can still fill the form in.';
  else if (!events?.length) hint = 'You have no events in Event Manager yet.';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <Field label="Start from an Event Manager event (optional)" hint={hint}>
        <select
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || failed || !events?.length}
        >
          <option value="">No event</option>
          {events?.map((event) => (
            <option key={event.id} value={event.id}>
              {eventDayLabel(event)} · {event.title}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
