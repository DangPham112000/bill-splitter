import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ClerkProvider } from '@clerk/react';
import { clerkPublishableKey } from '../lib/auth';

/**
 * The shared Clerk app (one session across every *.dantepham.site app), wired to React Router.
 * Any sign-in step that needs a full page (a Google sign-up that must be completed, "Add
 * account", ...) runs on this app's /sign-in and /sign-up pages instead of the shared Account
 * Portal, whose fallback is the root domain (no site there), so the user comes back here.
 */
export function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey!}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
