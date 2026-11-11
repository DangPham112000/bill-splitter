import type { Context } from '../auth.js';
import { getHealth } from '../health.js';
import { findUser } from '../coreUsers.js';
import { splitterResolvers } from './splitters.js';
import { deviceResolvers } from './devices.js';
import { memberResolvers } from './members.js';
import { transactionResolvers } from './transactions.js';
import { joiningResolvers } from './joining.js';

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
    ...deviceResolvers.Query,
  },
  Mutation: {
    ...splitterResolvers.Mutation,
    ...deviceResolvers.Mutation,
    ...memberResolvers.Mutation,
    ...transactionResolvers.Mutation,
    ...joiningResolvers.Mutation,
  },
  Splitter: { ...splitterResolvers.Splitter, ...transactionResolvers.Splitter },
  Transaction: transactionResolvers.Transaction,
  Member: splitterResolvers.Member,
  EventManagerEvent: splitterResolvers.EventManagerEvent,
  InvitePreview: joiningResolvers.InvitePreview,
  JoinableMember: joiningResolvers.JoinableMember,
};
