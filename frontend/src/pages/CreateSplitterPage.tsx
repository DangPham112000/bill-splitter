import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { cleanName, findSameName } from '@bill-splitter/shared';
import {
  CREATE_SPLITTER,
  EVENT_MANAGER_EVENTS,
  MY_SPLITTERS,
  type EventManagerEvent,
  type Splitter,
} from '../graphql/splitters';
import { SplitterForm } from '../components/SplitterForm';
import { EventPicker } from '../components/EventPicker';
import { ParticipantsEditor, type LinkedRow } from '../components/ParticipantsEditor';
import { emptySplitterForm, type SplitterFormValues } from '../lib/splitterForm';
import { SignInPrompt } from '../components/SignInPrompt';
import { Icon } from '../components/ui';
import { btn } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';
import { formFromEvent } from '../lib/eventPrefill';

const ME_NAME = gql`
  query MeName {
    me {
      clerkId
      name
    }
  }
`;

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
    .map((row) => ({ name: cleanName(row.name), clerkId: row.clerkId }));

  const { data: me } = useQuery<{ me: { name: string | null } | null }>(ME_NAME);
  // null until edited, so the account name can fill it in once it loads.
  const [adminName, setAdminName] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createSplitter, { loading }] = useMutation<{ createSplitter: Splitter }>(CREATE_SPLITTER, {
    refetchQueries: [MY_SPLITTERS],
  });

  const shownAdminName = adminName ?? me?.me?.name ?? '';
  const otherNames = memberNames.map(cleanName).filter(Boolean);
  const initial = event ? formFromEvent(event) : emptySplitterForm;

  const submit = async (values: SplitterFormValues) => {
    if (!shownAdminName.trim()) return setError('Enter your name in this splitter');
    // Same check as the backend: "Đăng" and "dang" would be one person to the group.
    const clash = findSameName([
      cleanName(shownAdminName),
      ...linkedMembers.map((m) => m.name),
      ...otherNames,
    ]);
    if (clash) return setError(`"${clash.name}" is the same name as "${clash.sameAs}"`);
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
            adminName: cleanName(shownAdminName),
            memberNames: otherNames,
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-1">
        <Link to={'/'} aria-label="Back" className={`${btn.icon} -ml-2`}>
          <Icon name="back" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New splitter</h1>
      </div>
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
        <ParticipantsEditor
          adminName={shownAdminName}
          onAdminName={setAdminName}
          eventRows={rows}
          onEventRow={setRow}
          names={memberNames}
          onNames={setMemberNames}
        />
      </SplitterForm>
    </div>
  );
}
