import { NavLink } from 'react-router';
import { useQuery } from '@apollo/client/react';
import { DEFAULT_EMOJI, MY_SPLITTERS, type Splitter } from '../graphql/splitters';
import { useAuthState } from '../lib/useAuthState';

/**
 * The desktop sidebar's list: splitters of the signed-in account, plus those joined through the
 * link on this device, signed in or not (DAN-39).
 */
export function SplitterNav() {
  const { isLoaded, isSignedIn } = useAuthState();
  const { data, loading } = useQuery<{ mySplitters: Splitter[] }>(MY_SPLITTERS, {
    skip: !isLoaded,
  });

  if (!isSignedIn && !data?.mySplitters.length) {
    return (
      <p className="px-2 text-sm text-muted-foreground">
        Sign in to see your splitters here. People you invite never need an account.
      </p>
    );
  }

  return (
    <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1">
      <h2 className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {isSignedIn ? 'My splitters' : 'Joined on this device'}
      </h2>
      {loading && <p className="px-2 text-sm text-muted-foreground">Loading…</p>}
      {data?.mySplitters.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">None yet.</p>
      )}
      {data?.mySplitters.map((splitter) => (
        <NavLink
          key={splitter.id}
          to={`/s/${splitter.id}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                : 'hover:bg-muted'
            }`
          }
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
            {splitter.coverEmoji || DEFAULT_EMOJI[splitter.type]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{splitter.name}</span>
            {splitter.me && !splitter.isAdmin && (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                as {splitter.me.displayName}
              </span>
            )}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
