import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { SignInButton, UserButton, useAuth } from '@clerk/react';
import { btn } from '../lib/styles';

/**
 * Optional sign-in: a "Sign in" button when signed out, the Clerk user menu when signed in.
 * Never blocks the page, because members use splitters without an account.
 */
export function AccountMenu({ showName = false }: { showName?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const client = useApolloClient();

  // Queries such as `me` depend on who is signed in, so refetch them when that changes.
  useEffect(() => {
    if (isLoaded) void client.refetchQueries({ include: 'active' });
  }, [client, isLoaded, isSignedIn]);

  if (!isLoaded) return null;
  if (isSignedIn) return <UserButton showName={showName} />;
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className={`${btn.secondary} py-1.5 text-sm ${showName ? 'w-full' : ''}`}
      >
        Sign in
      </button>
    </SignInButton>
  );
}
