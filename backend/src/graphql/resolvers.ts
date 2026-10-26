import type { Context } from '../auth.js';
import { getHealth } from '../health.js';
import { findUser } from '../coreUsers.js';
import { splitterResolvers } from './splitters.js';

export const resolvers = {
  Query: {
    health: () => getHealth(),
    // No User table: the Clerk user id is the identity, details come from core.users (DAN-93).
    me: async (_parent: unknown, _args: unknown, context: Context) => {
      if (!context.clerkId) return null;
      return (
        (await findUser(context.clerkId)) ?? {
          clerkId: context.clerkId,
          email: null,
          name: null,
          avatar: null,
        }
      );
    },
    ...splitterResolvers.Query,
  },
  Mutation: splitterResolvers.Mutation,
  Splitter: splitterResolvers.Splitter,
  Member: splitterResolvers.Member,
  EventManagerEvent: splitterResolvers.EventManagerEvent,
};
