import { verifyToken } from '@clerk/backend';
import { GraphQLError } from 'graphql';

/**
 * What resolvers see in `context`. Sign-in is optional: members join splitters anonymously,
 * so `clerkId` is null for most requests. Only actions such as creating a splitter need it.
 */
export interface Context {
  /** Clerk user id of the signed-in user (shared across the ecosystem apps), or null. */
  clerkId: string | null;
}

// Origins allowed to use a session token (the token's "azp" claim), comma-separated.
// In production only https://bills.dantepham.site, so tokens from other apps are refused.
const getAuthorizedParties = () =>
  process.env.CLERK_AUTHORIZED_PARTIES?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

let warnedMissingKey = false;

/**
 * Resolve the Clerk user id from an "Authorization: Bearer <Clerk session token>" header.
 * Returns null when there is no header, no secret key, or the token is invalid, so the request
 * carries on as an anonymous one instead of failing.
 */
export async function getClerkIdFromAuthHeader(header: string | undefined): Promise<string | null> {
  if (!header?.startsWith('Bearer ')) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    if (!warnedMissingKey) {
      console.warn('CLERK_SECRET_KEY is not set; every request is treated as signed out');
      warnedMissingKey = true;
    }
    return null;
  }

  try {
    const payload = await verifyToken(header.slice('Bearer '.length).trim(), {
      secretKey,
      authorizedParties: getAuthorizedParties(),
    });
    return payload.sub;
  } catch (error) {
    console.warn('Invalid Clerk session token:', (error as Error).message);
    return null;
  }
}

/** Throw an UNAUTHENTICATED error unless the request is signed in; returns the Clerk user id. */
export function requireClerkId(context: Context): string {
  if (!context.clerkId) {
    throw new GraphQLError('Sign in to do this', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return context.clerkId;
}
