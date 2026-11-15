import type { Request, Response } from 'express';

/**
 * OAuth for the MCP endpoint, with the shared Clerk app as the authorization server (DAN-125),
 * the same way as Event Manager.
 *
 * Connectors such as claude.ai, ChatGPT and Gemini only take an MCP URL. On a 401 they read the
 * protected resource metadata (RFC 9728) below, find Clerk, register themselves (dynamic client
 * registration, on in the Clerk dashboard), sign the user in, then call /mcp with the OAuth
 * access token Clerk issued.
 */

// Clerk's Frontend API URL is encoded in the publishable key:
// pk_live_<base64("clerk.dantepham.site$")> for the shared ecosystem Clerk app.
function clerkIssuerUrl(): string | null {
  const match = process.env.CLERK_PUBLISHABLE_KEY?.match(/^pk_(test|live)_(.+)$/);
  if (!match) return null;
  const host = Buffer.from(match[2], 'base64').toString('utf8').replace(/\$$/, '');
  return host ? `https://${host}` : null;
}

export const oauthIssuer = clerkIssuerUrl();

/** Public URL of the MCP endpoint, which is the OAuth "resource". */
export function mcpResourceUrl(req: Request): string {
  const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/mcp`;
}

export const resourceMetadataUrl = (req: Request) =>
  mcpResourceUrl(req).replace(/\/mcp$/, '/.well-known/oauth-protected-resource/mcp');

/** GET /.well-known/oauth-protected-resource[/mcp] */
export function protectedResourceMetadata(req: Request, res: Response) {
  if (!oauthIssuer) {
    res.status(404).json({ error: 'OAuth is not configured' });
    return;
  }
  res.set('Access-Control-Allow-Origin', '*').json({
    resource: mcpResourceUrl(req),
    authorization_servers: [oauthIssuer],
    bearer_methods_supported: ['header'],
    scopes_supported: ['profile', 'email'],
    resource_name: 'Bill Splitter',
  });
}

let cachedServerMetadata: { value: unknown; expires: number } | null = null;

/**
 * GET /.well-known/oauth-authorization-server: a copy of Clerk's metadata, for older clients
 * that look for it on the MCP server's own origin.
 */
export async function authorizationServerMetadata(_req: Request, res: Response) {
  if (!oauthIssuer) {
    res.status(404).json({ error: 'OAuth is not configured' });
    return;
  }
  try {
    if (!cachedServerMetadata || cachedServerMetadata.expires < Date.now()) {
      const response = await fetch(`${oauthIssuer}/.well-known/oauth-authorization-server`);
      if (!response.ok) throw new Error(`Clerk returned ${response.status}`);
      cachedServerMetadata = { value: await response.json(), expires: Date.now() + 60 * 60 * 1000 };
    }
    res.set('Access-Control-Allow-Origin', '*').json(cachedServerMetadata.value);
  } catch (error) {
    console.error('Could not fetch Clerk OAuth metadata:', error);
    res.status(502).json({ error: 'Authorization server metadata unavailable' });
  }
}
