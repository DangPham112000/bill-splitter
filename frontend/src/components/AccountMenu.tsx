import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { SignInButton, UserButton, useAuth } from '@clerk/react';

/**
 * Optional sign-in: a "Sign in" button when signed out, the Clerk user menu when signed in.
 * Never blocks the page, because members use splitters without an account.
 */
export function AccountMenu() {
  const { isLoaded, isSignedIn } = useAuth();
  const client = useApolloClient();

  // Queries such as `me` depend on who is signed in, so refetch them when that changes.
  useEffect(() => {
    if (isLoaded) void client.refetchQueries({ include: 'active' });
  }, [client, isLoaded, isSignedIn]);

  if (!isLoaded) return null;
  if (isSignedIn) return <UserButton />;
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
      >
        Sign in
      </button>
    </SignInButton>
  );
}
