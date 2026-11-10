import { Link, useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { currencySymbol } from '@bill-splitter/shared';
import {
  DEFAULT_EMOJI,
  GET_SPLITTER,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type Splitter,
} from '../graphql/splitters';
import { InvitePanel } from '../components/InvitePanel';
import { SignInPrompt } from '../components/SignInPrompt';
import { MemberList } from '../components/MemberList';
import { useAuthState } from '../lib/useAuthState';

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

      {splitter.inviteToken && (
        <InvitePanel
          splitterId={splitter.id}
          splitterName={splitter.name}
          token={splitter.inviteToken}
          joiningEnabled={splitter.joiningEnabled}
        />
      )}

      <MemberList
        splitterId={splitter.id}
        members={splitter.members}
        canManage={splitter.isAdmin && splitter.status === 'open'}
      />
    </div>
  );
}
