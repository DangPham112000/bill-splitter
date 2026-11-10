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
import { EmojiTile, Loading } from '../components/ui';
import { btn, cardClass } from '../lib/styles';

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

  if (loading) return <Loading />;
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
            <Notice title="Joining opens here soon">
              You will pick your name here, or add a new one, without signing in.
            </Notice>
          )}
        </div>
      </div>
    </div>
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
