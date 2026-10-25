// Publishable key of the shared Clerk app, inlined at build time from Doppler.
// Without it (a local build) the app runs signed out, which is fine because sign-in is optional.
export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export const authEnabled = Boolean(clerkPublishableKey);
