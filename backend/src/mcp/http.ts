import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getClerkIdFromOAuthToken, type Context } from '../auth.js';
import { API_KEY_PREFIX, agentDeviceId, clerkIdFromApiKey } from '../apiKeys.js';
import { createMcpServer } from './server.js';
import { oauthIssuer, resourceMetadataUrl } from './oauth.js';

/**
 * The credential is either a personal API key ("Authorization: Bearer bsk_..." or "?key=bsk_..."
 * for clients that cannot send headers), or a Clerk OAuth access token (see oauth.ts).
 */
function readCredential(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return typeof req.query.key === 'string' ? req.query.key : undefined;
}

async function authenticate(credential: string | undefined): Promise<string | null> {
  if (!credential) return null;
  if (credential.startsWith(API_KEY_PREFIX)) return clerkIdFromApiKey(credential);
  return getClerkIdFromOAuthToken(credential);
}

function rpcError(res: Response, status: number, message: string) {
  res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

/** POST /mcp: stateless Streamable HTTP, a fresh server per request (DAN-125). */
export async function handleMcpPost(req: Request, res: Response) {
  const clerkId = await authenticate(readCredential(req));
  if (!clerkId) {
    // Points OAuth-capable clients at the sign-in flow.
    if (oauthIssuer) {
      res.set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl(req)}"`);
    }
    rpcError(res, 401, 'Sign in, or use an API key from Bill Splitter → AI agents.');
    return;
  }

  // The tools call the GraphQL resolvers with this context, so every permission check is the
  // same as in the app. The agent acts as the signed-in user from its own "AI agent" device;
  // names picked anonymously on a phone stay with that phone.
  const context: Context = {
    clerkId,
    sessionToken: null,
    deviceId: await agentDeviceId(clerkId),
    cookieDeviceId: null,
    res,
  };

  const server = await createMcpServer(context);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) rpcError(res, 500, 'Internal server error');
  }
}

/** GET/DELETE /mcp: no sessions or server-sent streams in stateless mode. */
export function handleMcpNotAllowed(_req: Request, res: Response) {
  res.set('Allow', 'POST');
  rpcError(res, 405, 'Method not allowed.');
}
