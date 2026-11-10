import { useState, type FormEvent } from 'react';
import { useMutation } from '@apollo/client/react';
import { cleanName, nameMatches, normalizeName } from '@bill-splitter/shared';
import {
  ADD_MEMBER,
  REMOVE_MEMBER,
  RENAME_MEMBER,
  type Member,
  type MemberRole,
} from '../graphql/splitters';
import { inputClass } from '../lib/splitterForm';

const ROLE_LABELS: Record<MemberRole, string | null> = {
  admin: 'Admin',
  treasurer: 'Treasurer',
  member: null,
};

// Below this many members the whole list fits on a phone screen, so no search box.
const SEARCH_FROM = 8;

const smallButton =
  'rounded-lg border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-50 disabled:opacity-50';

type Props = {
  splitterId: string;
  members: Member[];
  /** The admin can add, rename and remove members (DAN-37). */
  canManage: boolean;
};

/** Same name to the group: "Đăng" and "dang" clash, like the backend's unique index (DAN-32). */
function sameNameAs(members: Member[], name: string, except?: string): Member | undefined {
  const key = normalizeName(name);
  return members.find((m) => m.id !== except && normalizeName(m.displayName) === key);
}

export function MemberList({ splitterId, members, canManage }: Props) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  // Accent-insensitive: "dang" finds "Phạm Đăng" (DAN-32).
  const shown = members.filter((member) => nameMatches(member.displayName, query));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-slate-500">Members ({members.length})</h2>
      {members.length >= SEARCH_FROM && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className={inputClass}
        />
      )}
      {shown.length === 0 ? (
        <p className="px-1 text-sm text-slate-500">No member matches "{query.trim()}".</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {shown.map((member) =>
            editingId === member.id ? (
              <RenameRow
                key={member.id}
                splitterId={splitterId}
                member={member}
                members={members}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <MemberRow
                key={member.id}
                splitterId={splitterId}
                member={member}
                canManage={canManage}
                onRename={() => setEditingId(member.id)}
              />
            ),
          )}
        </ul>
      )}
      {canManage && <AddMemberForm splitterId={splitterId} members={members} />}
    </section>
  );
}

function MemberRow({
  splitterId,
  member,
  canManage,
  onRename,
}: {
  splitterId: string;
  member: Member;
  canManage: boolean;
  onRename: () => void;
}) {
  const [remove, removing] = useMutation(REMOVE_MEMBER);
  const [error, setError] = useState<string | null>(null);
  const label = ROLE_LABELS[member.role];

  const confirmRemove = async () => {
    const ok = window.confirm(
      `Remove ${member.displayName}? Their name can no longer be picked when joining.`,
    );
    if (!ok) return;
    setError(null);
    try {
      await remove({ variables: { splitterId, memberId: member.id } });
    } catch (e) {
      // e.g. they are in a transaction, which would change everyone's balance.
      setError((e as Error).message);
    }
  };

  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words">{member.displayName}</span>
        <div className="flex shrink-0 items-center gap-2">
          {label && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {label}
            </span>
          )}
          {canManage && (
            <>
              <button type="button" onClick={onRename} className={smallButton}>
                Rename
              </button>
              {member.role !== 'admin' && (
                <button
                  type="button"
                  onClick={confirmRemove}
                  disabled={removing.loading}
                  className={`${smallButton} text-red-700`}
                >
                  {removing.loading ? 'Removing…' : 'Remove'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </li>
  );
}

function RenameRow({
  splitterId,
  member,
  members,
  onDone,
}: {
  splitterId: string;
  member: Member;
  members: Member[];
  onDone: () => void;
}) {
  const [name, setName] = useState(member.displayName);
  const [rename, renaming] = useMutation(RENAME_MEMBER);
  const [error, setError] = useState<string | null>(null);
  const clash = sameNameAs(members, name, member.id);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cleanName(name) || clash) return;
    setError(null);
    try {
      await rename({ variables: { splitterId, memberId: member.id, name } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <li className="px-3 py-2.5">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          autoFocus
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
          aria-label={`New name for ${member.displayName}`}
          className={inputClass}
        />
        {clash && <p className="text-sm text-amber-700">Same name as "{clash.displayName}".</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={renaming.loading || !cleanName(name) || Boolean(clash)}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {renaming.loading ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onDone} className={smallButton}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function AddMemberForm({ splitterId, members }: { splitterId: string; members: Member[] }) {
  const [name, setName] = useState('');
  const [add, adding] = useMutation(ADD_MEMBER);
  const [error, setError] = useState<string | null>(null);
  const clash = name.trim() ? sameNameAs(members, name) : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cleanName(name) || clash) return;
    setError(null);
    try {
      await add({ variables: { splitterId, name } });
      setName('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a member by name"
          aria-label="New member's name"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={adding.loading || !cleanName(name) || Boolean(clash)}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {adding.loading ? 'Adding…' : 'Add'}
        </button>
      </div>
      {clash ? (
        <p className="px-1 text-sm text-amber-700">
          "{clash.displayName}" is already in this splitter.
        </p>
      ) : (
        <p className="px-1 text-xs text-slate-500">
          They pick this name when they open the invite link.
        </p>
      )}
      {error && <p className="px-1 text-sm text-red-600">{error}</p>}
    </form>
  );
}
