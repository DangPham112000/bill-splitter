import { useState } from 'react';
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

        <div
          role="tablist"
          aria-label="Splitter sections"
          className="sticky top-14 z-20 -mx-4 bg-background/85 px-4 py-2 backdrop-blur lg:static lg:z-auto lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <div className="flex rounded-xl bg-muted p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={shownTab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  shownTab === t.id
                    ? 'bg-card text-foreground shadow-sm'
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

function SplitterHeader({ splitter }: { splitter: Splitter }) {
  const dates = formatDateRange(splitter.startDate, splitter.endDate);
  const meta = [
    SPLITTER_TYPE_LABELS[splitter.type],
    dates,
    `${splitter.currency} ${currencySymbol(splitter.currency)}`,
    splitter.hasInitialFund ? 'Initial fund' : null,
  ].filter(Boolean);

  return (
    <header className="overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-soft to-card p-4 lg:p-6">
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
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-sm font-medium text-primary shadow-sm hover:bg-muted"
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
