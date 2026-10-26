import { SignInButton } from '@clerk/react';
import { authEnabled } from '../lib/auth';

/** Shown where an action needs an account. Everything else in the app works signed out. */
export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-6 text-center">
      <p className="text-slate-700">{message}</p>
      {authEnabled ? (
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-700"
          >
            Sign in
          </button>
        </SignInButton>
      ) : (
        <p className="text-sm text-slate-500">Sign-in is not set up in this build.</p>
      )}
    </div>
  );
}
