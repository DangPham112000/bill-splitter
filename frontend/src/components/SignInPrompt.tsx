import { SignInButton } from '@clerk/react';
import { authEnabled } from '../lib/auth';
import { btn, cardClass } from '../lib/styles';

/** Shown where an action needs an account. Everything else in the app works signed out. */
export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className={`${cardClass} flex flex-col items-center gap-4 px-6 py-10 text-center`}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl">
        🔐
      </span>
      <p className="max-w-sm text-foreground/90">{message}</p>
      {authEnabled ? (
        <SignInButton mode="modal">
          <button type="button" className={btn.primary}>
            Sign in
          </button>
        </SignInButton>
      ) : (
        <p className="text-sm text-muted-foreground">Sign-in is not set up in this build.</p>
      )}
    </div>
  );
}
