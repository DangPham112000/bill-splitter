import { SignIn, SignUp } from '@clerk/react';

/** Clerk's sign-in or sign-up as a full page, on this app's own domain. */
export function SignInPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      {mode === 'sign-in' ? (
        <SignIn routing="path" path="/sign-in" />
      ) : (
        <SignUp routing="path" path="/sign-up" />
      )}
    </div>
  );
}
