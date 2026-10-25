import type { Context } from '../auth.js';
import { getHealth } from '../health.js';

export const resolvers = {
  Query: {
    health: () => getHealth(),
    // No User table: the Clerk user id is the identity. Names and avatars come from Clerk on
    // the frontend for now, and from the shared core.users later (DAN-93).
    me: (_parent: unknown, _args: unknown, context: Context) =>
      context.clerkId ? { clerkId: context.clerkId } : null,
  },
};
