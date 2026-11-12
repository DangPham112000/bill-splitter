import { Link } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { MY_SPLITTERS, type Splitter } from '../graphql/splitters';
import { SplitterCard } from '../components/SplitterCard';
import { Card, EmptyState, Icon, Loading, SectionTitle } from '../components/ui';
import { btn } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';
import { useIsDesktop } from '../lib/useIsDesktop';

const STEPS = [
  { icon: '🔗', title: 'Share one link', text: 'Friends join from Zalo or Messenger, no account.' },
  {
    icon: '🧾',
    title: 'Everyone adds',
    text: 'Each person enters what they paid, on their phone.',
  },
  { icon: '🤝', title: 'Settle up', text: 'See who pays whom, with the fewest transfers.' },
];

export function HomePage() {
  const { isLoaded, isSignedIn } = useAuthState();
  const isDesktop = useIsDesktop();
  // Signed out too: splitters joined through the link on this device (DAN-39).
  const { data, loading } = useQuery<{ mySplitters: Splitter[] }>(MY_SPLITTERS, {
    skip: !isLoaded,
  });
  const splitters = data?.mySplitters ?? [];
  const hasSplitters = splitters.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {(!isSignedIn || (!loading && !hasSplitters) || isDesktop) && (
        <section className="glass-primary overflow-hidden rounded-3xl px-6 py-8 text-primary-foreground lg:px-10 lg:py-12">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-4xl">
            Split costs with your group
          </h1>
          <p className="mt-2 max-w-xl text-primary-foreground/85 lg:text-lg">
            For a trip, a party or a project: everyone adds what they paid, and the app works out
            who pays whom with the fewest transfers.
          </p>
          <Link
            to="/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/85 px-5 py-3 font-semibold text-[oklch(0.5_0.17_45)] shadow-[inset_0_1px_0_white,0_6px_16px_-6px_rgb(0_0_0/0.25)] backdrop-blur-md transition-colors hover:bg-white"
          >
            <Icon name="plus" />
            Create a splitter
          </Link>
        </section>
      )}

      {(!isSignedIn || isDesktop) && (
        <section className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <Card key={step.title} className="flex gap-3 p-4 sm:flex-col">
              <span className="text-2xl">{step.icon}</span>
              <span>
                <span className="block font-medium">{step.title}</span>
                <span className="block text-sm text-muted-foreground">{step.text}</span>
              </span>
            </Card>
          ))}
        </section>
      )}

      {(isSignedIn || hasSplitters) && (
        <section className="flex flex-col gap-2">
          <SectionTitle>{isSignedIn ? 'My splitters' : 'Joined on this device'}</SectionTitle>
          {loading ? (
            <Loading />
          ) : hasSplitters ? (
            <Card className="divide-y divide-border overflow-hidden">
              {splitters.map((splitter) => (
                <SplitterCard key={splitter.id} splitter={splitter} />
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyState icon="🧳" title="No splitters yet">
                Create one for your next trip or party, then share the link with the group.
              </EmptyState>
            </Card>
          )}
        </section>
      )}

      {/* Phone: the big round "+" in the corner, like most expense apps. */}
      {!isDesktop && isSignedIn && hasSplitters && (
        <Link
          to="/new"
          aria-label="Create a splitter"
          className={`${btn.primary} fixed right-5 bottom-6 z-20 h-14 px-5`}
        >
          <Icon name="plus" />
          New
        </Link>
      )}
    </div>
  );
}
