import { useAuth } from '@clerk/react';
import { authEnabled } from './auth';

type AuthState = { isLoaded: boolean; isSignedIn: boolean };

function useClerkAuthState(): AuthState {
  const { isLoaded, isSignedIn } = useAuth();
  return { isLoaded, isSignedIn: Boolean(isSignedIn) };
}

const signedOut = (): AuthState => ({ isLoaded: true, isSignedIn: false });

/**
 * Whether someone is signed in. A build without a Clerk key has no ClerkProvider, so it is
 * always signed out instead of calling Clerk's hooks. Picked once, so the hook order is stable.
 */
export const useAuthState = authEnabled ? useClerkAuthState : signedOut;
