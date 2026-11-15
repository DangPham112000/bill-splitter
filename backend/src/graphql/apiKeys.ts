import { GraphQLError } from 'graphql';
import { requireClerkId, type Context } from '../auth.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../apiKeys.js';

/**
 * The signed-in user, only when the request comes from Bill Splitter itself: another ecosystem
 * app calling with the user's session token must not be able to mint keys (as in Event Manager).
 */
function requireOwnApp(context: Context): string {
  const clerkId = requireClerkId(context);
  if (context.fromOtherApp) {
    throw new GraphQLError('Only Bill Splitter itself can do this', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return clerkId;
}

/** Personal API keys for AI agents (DAN-125); always the signed-in user's own. */
export const apiKeyResolvers = {
  Query: {
    apiKeys: (_parent: unknown, _args: unknown, context: Context) =>
      listApiKeys(requireOwnApp(context)),
  },
  Mutation: {
    createApiKey: (_parent: unknown, { name }: { name: string }, context: Context) =>
      createApiKey(requireOwnApp(context), name),
    revokeApiKey: (_parent: unknown, { id }: { id: string }, context: Context) =>
      revokeApiKey(requireOwnApp(context), id),
  },
};
