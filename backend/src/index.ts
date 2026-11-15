import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import { getHealth } from './health.js';
import { joinLinkPreview } from './linkPreview.js';
import { contextFromRequest, type Context } from './auth.js';
import { handleMcpNotAllowed, handleMcpPost } from './mcp/http.js';
import {
  authorizationServerMetadata,
  oauthIssuer,
  protectedResourceMetadata,
} from './mcp/oauth.js';
// Registers the Mongoose models so their indexes are built on connect.
import './models/index.js';

const port = Number(process.env.PORT) || 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bill-splitter';

async function startServer() {
  const app = express();

  // Returns 503 while MongoDB is unreachable, so Docker and uptime checks notice.
  app.get('/health', (_req, res) => {
    const health = getHealth();
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  // Link preview tags for /join/<token>, included into index.html by the frontend nginx (DAN-36).
  app.get('/link-preview/join/:token', joinLinkPreview);

  const server = new ApolloServer<Context>({ typeDefs, resolvers });
  await server.start();
  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      // Sign-in is optional: a missing or invalid token just means an anonymous request.
      context: ({ req, res }) => contextFromRequest(req, res),
    }),
  );

  // MCP for AI agents (DAN-125): Clerk OAuth for connectors, personal API keys for bots.
  app.post('/mcp', cors<cors.CorsRequest>(), express.json({ limit: '1mb' }), handleMcpPost);
  app.get('/mcp', handleMcpNotAllowed);
  app.delete('/mcp', handleMcpNotAllowed);
  app.get(
    ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'],
    protectedResourceMetadata,
  );
  app.get('/.well-known/oauth-authorization-server', authorizationServerMetadata);
  if (!oauthIssuer) {
    console.warn('CLERK_PUBLISHABLE_KEY is not set; AI agents can only use /mcp with API keys');
  }

  app.listen(port, () => {
    console.log(`Server ready at http://localhost:${port}/graphql`);
  });

  // Connect after listening, so /health can report a database that is still starting.
  mongoose.connection.on('connected', () => console.log('Connected to MongoDB'));
  mongoose.connection.on('disconnected', () => console.warn('Disconnected from MongoDB'));
  await mongoose.connect(mongoUri);
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
