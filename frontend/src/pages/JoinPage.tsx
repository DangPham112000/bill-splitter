import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { currencySymbol } from '@bill-splitter/shared';
import {
  DEFAULT_EMOJI,
  GET_INVITE,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type InvitePreview,
} from '../graphql/splitters';

/** Where a join link lands (DAN-36). Picking or creating a name comes with DAN-41. */
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

  if (loading) return <p className="pt-6 text-slate-400">Loading…</p>;
  if (error) return <p className="pt-6 text-red-600">Could not open this link: {error.message}</p>;
  if (!invite) {
    return (
      <Notice title="This link no longer works">
        The admin may have made a new link. Ask them to send you the current one.
      </Notice>
    );
  }

  const dates = formatDateRange(invite.startDate, invite.endDate);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-5xl">
          {invite.coverEmoji || DEFAULT_EMOJI[invite.type]}
        </span>
        <p className="text-sm text-slate-500">You are invited to</p>
        <h1 className="text-2xl font-semibold break-words">{invite.name}</h1>
        <p className="text-sm text-slate-500">
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

      {invite.splitterId ? (
        <Link
          to={`/s/${invite.splitterId}`}
          className="rounded-lg bg-sky-600 px-4 py-2.5 text-center font-medium text-white hover:bg-sky-700"
        >
          You're already in. Open the splitter
        </Link>
      ) : !invite.joiningEnabled ? (
        <Notice title="Joining is turned off">
          The admin has closed this splitter to new members. Ask them to turn joining back on.
        </Notice>
      ) : (
        <Notice title="Joining opens here soon">
          You will pick your name here, or add a new one, without signing in.
        </Notice>
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-1 rounded-xl border border-slate-200 p-6 text-center">
      <h2 className="font-medium">{title}</h2>
      <p className="text-sm text-slate-600">{children}</p>
    </div>
  );
}
