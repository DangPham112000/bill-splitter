import mongoose from 'mongoose';
import { createClerkClient } from '@clerk/backend';

/**
 * Shared user table `core.users` (DAN-91). The core-users service in ecosystem-infra is its
 * only writer and keeps it in sync with Clerk; this app's Mongo user can only read it. Bill
 * Splitter has no user table: users are their Clerk id (`Splitter.adminUserId`,
 * `Member.userId`), and their email, name and avatar come from here (DAN-93).
 */
export interface CoreUser {
  clerkId: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
}

export function coreUsers() {
  return mongoose.connection.useDb('core', { useCache: true }).collection<CoreUser>('users');
}

const pick = (doc: CoreUser): CoreUser => ({
  clerkId: doc.clerkId,
  email: doc.email ?? null,
  name: doc.name || (doc.email ? doc.email.split('@')[0] : null),
  avatar: doc.avatar || null,
});

let clerk: ReturnType<typeof createClerkClient> | null | undefined;
function getClerk() {
  if (clerk === undefined) {
    const secretKey = process.env.CLERK_SECRET_KEY;
    clerk = secretKey ? createClerkClient({ secretKey }) : null;
  }
  return clerk;
}

/** Ask Clerk directly, for a brand-new user whose webhook has not reached core.users yet. */
async function fromClerk(clerkId: string): Promise<CoreUser | null> {
  const client = getClerk();
  if (!client) return null;
  try {
    const u = await client.users.getUser(clerkId);
    const email = (
      u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress
    )?.toLowerCase();
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || null;
    return pick({ clerkId, email: email ?? null, name, avatar: u.imageUrl || null });
  } catch (error) {
    console.warn(`User ${clerkId} not found in core.users or Clerk:`, (error as Error).message);
    return null;
  }
}

/**
 * The user for a Clerk id, read from core.users, with the Clerk API as fallback. Never writes
 * core.users. Null when the user is unknown to both (for example, deleted).
 */
export async function findUser(clerkId: string): Promise<CoreUser | null> {
  const doc = await coreUsers().findOne({ clerkId });
  return doc ? pick(doc) : fromClerk(clerkId);
}

/**
 * Look up many users at once (a splitter's admin and linked members). Ids missing from
 * core.users are asked from Clerk one by one; ids unknown to both are left out of the map.
 */
export async function findUsers(clerkIds: string[]): Promise<Map<string, CoreUser>> {
  const ids = [...new Set(clerkIds)];
  const docs = ids.length
    ? await coreUsers()
        .find({ clerkId: { $in: ids } })
        .toArray()
    : [];
  const found = new Map(docs.map((doc) => [doc.clerkId, pick(doc)]));
  for (const id of ids) {
    if (found.has(id)) continue;
    const user = await fromClerk(id);
    if (user) found.set(id, user);
  }
  return found;
}

/** For finding people to invite later. Not exposed through the API (DAN-93). */
export async function findUserByEmail(email: string): Promise<CoreUser | null> {
  const doc = await coreUsers().findOne({ email: email.trim().toLowerCase() });
  return doc ? pick(doc) : null;
}
