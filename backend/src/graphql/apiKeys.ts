import { requireClerkId, type Context } from '../auth.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../apiKeys.js';

/** Personal API keys for AI agents (DAN-125); always the signed-in user's own. */
export const apiKeyResolvers = {
  Query: {
    apiKeys: (_parent: unknown, _args: unknown, context: Context) =>
      listApiKeys(requireClerkId(context)),
  },
  Mutation: {
    createApiKey: (_parent: unknown, { name }: { name: string }, context: Context) =>
      createApiKey(requireClerkId(context), name),
    revokeApiKey: (_parent: unknown, { id }: { id: string }, context: Context) =>
      revokeApiKey(requireClerkId(context), id),
  },
};
