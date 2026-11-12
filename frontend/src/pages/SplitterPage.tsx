import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery } from '@apollo/client/react';
import { currencySymbol } from '@bill-splitter/shared';
import {
  DEFAULT_EMOJI,
  GET_SPLITTER,
  LINK_MY_ACCOUNT,
  SPLITTER_TYPE_LABELS,
  formatDateRange,
  type Splitter,
} from '../graphql/splitters';
import { InvitePanel } from '../components/InvitePanel';
import { SignInPrompt } from '../components/SignInPrompt';
import { MemberList } from '../components/MemberList';
import { ExpenseList } from '../components/ExpenseList';
import { BalanceList } from '../components/BalanceList';
import { Card, EmojiTile, EmptyState, Icon, Loading } from '../components/ui';
import { btn } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';
import { useIsDesktop } from '../lib/useIsDesktop';

type Tab = 'expenses' | 'balances' | 'members';

const TABS: { id: Tab; label: string; icon: 'receipt' | 'scale' | 'users' }[] = [
  { id: 'expenses', label: 'Expenses', icon: 'receipt' },
  { id: 'balances', label: 'Balances', icon: 'scale' },
  { id: 'members', label: 'Members', icon: 'users' },
];

export function SplitterPage() {
  const { id } = useParams();
  const { isLoaded, isSignedIn } = useAuthState();
  // Members who joined through the link on this device open it signed out (DAN-41).
  const { data, loading, error } = useQuery<{ splitter: Splitter | null }>(GET_SPLITTER, {
    variables: { id },
    skip: !isLoaded,
  });

  if (!isLoaded || (loading && !data)) return <Loading />;
  if (error || !data?.splitter) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <EmptyState icon="🔍" title="Splitter not found">
            {isSignedIn
              ? 'This splitter does not exist, or you have not joined it. Open the invite link to join.'
              : 'You have not joined this splitter on this device. Open the invite link to pick your name.'}
          </EmptyState>
        </Card>
        {!isSignedIn && (
          <SignInPrompt message="Is your name linked to an account? Sign in to open it." />
        )}
      </div>
    );
  }
  return <SplitterView splitter={data.splitter} />;
}

/**
 * Phone: header, then tabs for expenses, balances and members, like a mobile expense app.
 * Desktop: expenses and balances on the left, the people (invite link and members) on the right.
 */
function SplitterView({ splitter }: { splitter: Splitter }) {
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>('expenses');
  const tabs = isDesktop ? TABS.filter((t) => t.id !== 'members') : TABS;
  // The members tab does not exist on desktop, where members sit in the side column.
  const shownTab = isDesktop && tab === 'members' ? 'expenses' : tab;

  const people = (
    <div className="flex flex-col gap-5">
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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-4">
        <SplitterHeader splitter={splitter} />
        {splitter.canLinkAccount && splitter.me && (
          <LinkAccountBanner splitterId={splitter.id} name={splitter.me.displayName} />
        )}

        <div
          role="tablist"
          aria-label="Splitter sections"
          className="sticky top-16 z-20 lg:static lg:z-auto"
        >
          <div className="glass flex rounded-full p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={shownTab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  shownTab === t.id
                    ? 'glass-thumb text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={t.icon} className="h-4 w-4" />
                {t.label}
                {t.id === 'members' && (
                  <span className="text-xs text-muted-foreground">{splitter.members.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel">
          {shownTab === 'expenses' && (
            <ExpenseList
              splitterId={splitter.id}
              currency={splitter.currency}
              canAdd={Boolean(splitter.me) && splitter.status === 'open'}
            />
          )}
          {shownTab === 'balances' && (
            <BalanceList
              splitterId={splitter.id}
              currency={splitter.currency}
              members={splitter.members}
            />
          )}
          {shownTab === 'members' && people}
        </div>
      </div>

      {isDesktop && <aside className="sticky top-8">{people}</aside>}
    </div>
  );
}

/**
 * For someone who joined signed out (or left "Link this name to my account" unticked) and has
 * signed in since: one tap puts the splitter in My splitters on every device.
 */
function LinkAccountBanner({ splitterId, name }: { splitterId: string; name: string }) {
  const [link, { loading }] = useMutation(LINK_MY_ACCOUNT, { refetchQueries: ['MySplitters'] });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await link({ variables: { splitterId } });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1 text-sm">
        You joined as <strong>{name}</strong> on this device only. Link this name to your account to
        see this splitter in My splitters on every device you sign in on.
        {error && <span className="mt-1 block text-destructive">{error}</span>}
      </p>
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className={`${btn.primary} shrink-0 text-sm`}
      >
        {loading ? 'Linking…' : 'Link to my account'}
      </button>
    </Card>
  );
}

function SplitterHeader({ splitter }: { splitter: Splitter }) {
  const dates = formatDateRange(splitter.startDate, splitter.endDate);
  const meta = [
    SPLITTER_TYPE_LABELS[splitter.type],
    dates,
    `${splitter.currency} ${currencySymbol(splitter.currency)}`,
    splitter.hasInitialFund ? 'Initial fund' : null,
  ].filter(Boolean);

  return (
    <header className="glass overflow-hidden rounded-3xl bg-gradient-to-br from-primary-soft to-transparent p-4 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link to="/" className={`${btn.ghost} -ml-2 px-2 py-1 text-sm lg:hidden`}>
          <Icon name="back" className="h-4 w-4" />
          Splitters
        </Link>
        {splitter.isAdmin && (
          <Link to={`/s/${splitter.id}/edit`} className={`${btn.small} ml-auto`}>
            <Icon name="edit" className="h-4 w-4" />
            Edit
          </Link>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 lg:mt-0">
        <EmojiTile emoji={splitter.coverEmoji || DEFAULT_EMOJI[splitter.type]} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words lg:text-3xl">
            {splitter.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{meta.join(' · ')}</p>
        </div>
      </div>

      {splitter.description && (
        <p className="mt-4 whitespace-pre-line text-sm text-foreground/80">
          {splitter.description}
        </p>
      )}

      {(splitter.linkedEvent || splitter.myRole === 'treasurer') && (
        <div className="mt-4 flex flex-wrap gap-2">
          {splitter.linkedEvent && (
            <a
              href={splitter.linkedEvent.url}
              target="_blank"
              rel="noreferrer"
              className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-primary-soft-foreground hover:bg-card"
            >
              Open in Event Manager
              <Icon name="external" className="h-3.5 w-3.5" />
            </a>
          )}
          {splitter.myRole === 'treasurer' && (
            <span className="rounded-full bg-warning-soft px-3 py-1 text-sm text-warning">
              You are a treasurer: you can change anyone's transactions and manage the fund.
            </span>
          )}
        </div>
      )}
    </header>
  );
}
