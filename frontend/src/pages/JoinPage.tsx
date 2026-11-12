import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@apollo/client/react';
import { cleanName, currencySymbol, nameMatches, normalizeName } from '@bill-splitter/shared';
import {
  DEFAULT_EMOJI,
  GET_INVITE,
  JOIN_SPLITTER,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type InvitePreview,
  type JoinSplitterInput,
  type JoinableMember,
  type Splitter,
} from '../graphql/splitters';
import { DeviceNicknameDialog } from '../components/DeviceNicknameDialog';
import { DisabledReason } from '../components/DisabledReason';
import { Avatar, EmojiTile, Loading } from '../components/ui';
import { useDevice } from '../lib/deviceContext';
import { btn, cardClass, inputClass } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';

// Below this many names the whole list fits on a phone screen, so no search box.
const SEARCH_FROM = 8;

const ROLE_LABELS: Record<JoinableMember['role'], string | null> = {
  admin: 'Admin',
  treasurer: 'Treasurer',
  member: null,
};

/** Where a join link lands (DAN-36): the splitter, then "Who are you?" (DAN-41). */
export function JoinPage() {
  const { token = '' } = useParams();
  const { data, loading, error } = useQuery<{ invite: InvitePreview | null }>(GET_INVITE, {
    variables: { token },
  });
  const invite = data?.invite;

  useEffect(() => {
    if (invite) document.title = `${invite.name} · Bill Splitter`;
    return () => {
      document.title = 'Bill Splitter';
    };
  }, [invite]);

  if (loading && !invite) return <Loading />;
  if (error)
    return <p className="pt-6 text-destructive">Could not open this link: {error.message}</p>;
  if (!invite) {
    return (
      <Notice title="This link no longer works">
        The admin may have made a new link. Ask them to send you the current one.
      </Notice>
    );
  }

  const dates = formatDateRange(invite.startDate, invite.endDate);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 lg:pt-8">
      <div className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-primary-soft to-card px-6 pt-8 pb-6 text-center">
          <EmojiTile emoji={invite.coverEmoji || DEFAULT_EMOJI[invite.type]} size="lg" />
          <p className="text-sm text-muted-foreground">You are invited to</p>
          <h1 className="text-2xl font-semibold tracking-tight break-words">{invite.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[
              SPLITTER_TYPE_LABELS[invite.type],
              dates,
              `${invite.currency} ${currencySymbol(invite.currency)}`,
              `${invite.memberCount} ${invite.memberCount === 1 ? 'member' : 'members'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="px-6 pb-6">
          {invite.splitterId ? (
            <Link to={`/s/${invite.splitterId}`} className={`${btn.primary} w-full py-3`}>
              You're already in. Open the splitter
            </Link>
          ) : !invite.joiningEnabled ? (
            <Notice title="Joining is turned off">
              The admin has closed this splitter to new members. Ask them to turn joining back on.
            </Notice>
          ) : (
            <JoinForm token={token} invite={invite} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Who are you?": pick your name (this device's names first) or add a new one, no sign-in.
 * A new name that matches an existing one ignoring accents ("Dang" and "Đăng") is not added:
 * the form suggests the existing name instead, since it is most likely the same person.
 */
function JoinForm({ token, invite }: { token: string; invite: InvitePreview }) {
  const navigate = useNavigate();
  const { device } = useDevice();
  const { isSignedIn } = useAuthState();
  const [join, { loading: joining }] = useMutation<
    { joinSplitter: Splitter },
    { token: string; input: JoinSplitterInput }
  >(JOIN_SPLITTER, {
    // The splitter now belongs in the sidebar and home list (DAN-39).
    refetchQueries: ['MySplitters'],
  });

  const members = invite.members;
  const locked = invite.status === 'locked';
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  // Nobody to pick yet (only the admin's name, say): start on "I'm new".
  const [isNew, setIsNew] = useState(!locked && members.length === 0);
  const [name, setName] = useState('');
  const [linkAccount, setLinkAccount] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinedId, setJoinedId] = useState<string | null>(null);

  const shown = members.filter((m) => nameMatches(m.displayName, query));
  const picked = members.find((m) => m.id === pickedId) ?? null;
  const cleaned = cleanName(name);
  const sameName = cleaned
    ? members.find((m) => normalizeName(m.displayName) === normalizeName(cleaned))
    : undefined;
  // A signed-in person is not someone else's account; the server refuses that pick too.
  const takenByOther = (m: JoinableMember) => Boolean(isSignedIn && m.hasAccount && !m.isMe);
  const canLink = isSignedIn && (isNew || (picked !== null && !picked.hasAccount));

  const choice = isNew ? (cleaned && !sameName ? cleaned : null) : picked?.displayName;
  const ready = Boolean(choice) && device !== null && !joining;

  const pick = (member: JoinableMember) => {
    setPickedId(member.id);
    setIsNew(false);
    setError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    try {
      const input: JoinSplitterInput = isNew ? { name: cleaned } : { memberId: picked!.id };
      if (canLink && linkAccount) input.linkAccount = true;
      const { data } = await join({ variables: { token, input } });
      if (!data) throw new Error('Could not join');
      const id = data.joinSplitter.id;
      // DAN-30: the first time someone joins on this device, ask what to call the device.
      if (device && !device.nickname) setJoinedId(id);
      else navigate(`/s/${id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-lg font-semibold">Who are you?</h2>
        <p className="text-sm text-muted-foreground">
          Pick your name, or add yourself. No account needed.
        </p>
      </div>

      {members.length >= SEARCH_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names"
          aria-label="Search names"
          className={inputClass}
        />
      )}

      {members.length > 0 && (
        <ul role="radiogroup" aria-label="Members" className="flex flex-col gap-1.5">
          {shown.map((member) => {
            const disabled = takenByOther(member);
            const selected = !isNew && pickedId === member.id;
            return (
              <li key={member.id}>
                <DisabledReason
                  className="flex w-full"
                  reason={
                    disabled &&
                    `${member.displayName} is linked to someone else's account, so only they ` +
                      'can pick it. If this is you, sign in with that account.'
                  }
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => pick(member)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:bg-muted disabled:hover:bg-transparent'
                    }`}
                  >
                    <Avatar name={member.displayName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{member.displayName}</span>
                      <MemberHint member={member} takenByOther={disabled} />
                    </span>
                    {ROLE_LABELS[member.role] && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}
                  </button>
                </DisabledReason>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="py-2 text-center text-sm text-muted-foreground">
              No name matches "{query}".
            </li>
          )}
        </ul>
      )}

      {locked ? (
        <p className="text-center text-sm text-muted-foreground">
          This splitter is locked, so no new names can be added.
        </p>
      ) : isNew ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Your name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={50}
              placeholder="e.g. Phạm Đăng"
              className={inputClass}
            />
          </label>
          {sameName && (
            <div className="flex flex-col gap-2 rounded-xl bg-warning-soft p-3 text-sm">
              <p className="text-warning">
                <strong>{sameName.displayName}</strong> is already here. Is that you?
              </p>
              <div className="flex flex-wrap gap-2">
                {!takenByOther(sameName) && (
                  <button type="button" onClick={() => pick(sameName)} className={btn.small}>
                    Yes, I'm {sameName.displayName}
                  </button>
                )}
                <span className="self-center text-muted-foreground">
                  If not, add something to tell you apart, e.g. "{sameName.displayName} B".
                </span>
              </div>
            </div>
          )}
          {members.length > 0 && (
            <button
              type="button"
              onClick={() => setIsNew(false)}
              className={`${btn.ghost} self-start px-2 py-1 text-sm`}
            >
              Back to the list
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsNew(true);
            setPickedId(null);
            setError(null);
          }}
          className={`${btn.secondary} w-full`}
        >
          I'm new, add my name
        </button>
      )}

      {canLink && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={linkAccount}
            onChange={(e) => setLinkAccount(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            Link this name to my account
            <span className="block text-muted-foreground">
              The splitter shows up in My splitters on any device you sign in on.
            </span>
          </span>
        </label>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DisabledReason
        className="flex w-full"
        reason={
          device !== null &&
          !joining &&
          !choice &&
          (isNew && sameName
            ? `"${sameName.displayName}" is already here. Pick it above, or type a different name.`
            : 'Pick your name above, or add yourself with a new one.')
        }
      >
        <button type="submit" disabled={!ready} className={`${btn.primary} w-full py-3`}>
          {device === null ? 'Getting this device ready…' : choice ? `Join as ${choice}` : 'Join'}
        </button>
      </DisabledReason>

      {joinedId && (
        <DeviceNicknameDialog
          reason="join"
          onClose={() => navigate(`/s/${joinedId}`, { replace: true })}
        />
      )}
    </form>
  );
}

function MemberHint({ member, takenByOther }: { member: JoinableMember; takenByOther: boolean }) {
  const hint = takenByOther
    ? 'Linked to another account'
    : member.usedOnThisDevice
      ? 'Used on this device'
      : null;
  if (!hint) return null;
  return (
    <span
      className={`block text-xs ${member.usedOnThisDevice && !takenByOther ? 'text-primary' : 'text-muted-foreground'}`}
    >
      {hint}
    </span>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-muted p-5 text-center">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
