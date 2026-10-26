import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { currencySymbol } from '@bill-splitter/shared';
import {
  DEFAULT_EMOJI,
  GET_SPLITTER,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type MemberRole,
  type Splitter,
} from '../graphql/splitters';
import { SignInPrompt } from '../components/SignInPrompt';
import { useAuthState } from '../lib/useAuthState';

const ROLE_LABELS: Record<MemberRole, string | null> = {
  admin: 'Admin',
  treasurer: 'Treasurer',
  member: null,
};

export function SplitterPage() {
  const { id } = useParams();
  const { isLoaded, isSignedIn } = useAuthState();
  const { data, loading, error } = useQuery<{ splitter: Splitter | null }>(GET_SPLITTER, {
    variables: { id },
    skip: !isSignedIn,
  });

  if (!isLoaded || loading) return <p className="pt-6 text-slate-400">Loading…</p>;
  // Until joining through the link exists (DAN-41), only the admin can open a splitter.
  if (!isSignedIn) return <SignInPrompt message="Sign in to open this splitter." />;
  if (error || !data?.splitter) {
    return <p className="pt-6 text-slate-600">This splitter does not exist or is not yours.</p>;
  }

  const splitter = data.splitter;
  const dates = formatDateRange(splitter.startDate, splitter.endDate);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-3xl">
          {splitter.coverEmoji || DEFAULT_EMOJI[splitter.type]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold break-words">{splitter.name}</h1>
          <p className="text-sm text-slate-500">
            {[
              SPLITTER_TYPE_LABELS[splitter.type],
              dates,
              `${splitter.currency} ${currencySymbol(splitter.currency)}`,
              splitter.hasInitialFund ? 'Initial fund' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {splitter.isAdmin && (
          <Link
            to={`/s/${splitter.id}/edit`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Edit
          </Link>
        )}
      </div>

      {(splitter.description || splitter.linkedEvent) && (
        <section className="flex flex-col gap-2 text-left">
          {splitter.description && (
            <p className="whitespace-pre-line text-slate-700">{splitter.description}</p>
          )}
          {splitter.linkedEvent && (
            <a
              href={splitter.linkedEvent.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-sky-700 hover:underline"
            >
              Open the event in Event Manager ↗
            </a>
          )}
        </section>
      )}

      {splitter.inviteToken && <InviteLink token={splitter.inviteToken} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-500">Members ({splitter.members.length})</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {splitter.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-3 py-2.5">
              <span>{member.displayName}</span>
              {ROLE_LABELS[member.role] && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {ROLE_LABELS[member.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join/${token}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (e.g. not HTTPS): the link is still selectable.
    }
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <h2 className="text-sm font-medium text-sky-800">Invite link</h2>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-sky-700">
        Joining through this link is coming next; for now only you can open this splitter.
      </p>
    </section>
  );
}
