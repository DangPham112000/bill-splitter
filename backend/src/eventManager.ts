import { GraphQLError } from 'graphql';

// Client for Event Manager's GraphQL API (DAN-96). Bill Splitter calls it server to server with
// the user's own Clerk session token, so Event Manager decides which events the user may see.
// Event Manager accepts the token because every ecosystem origin is in its
// CLERK_AUTHORIZED_PARTIES (ecosystem-knowledge decisions.md, 2026-10-26).

/** Internal address on the shared `ecosystem` Docker network (alias set in Event Manager's compose). */
const graphqlUrl = () =>
  process.env.EVENT_MANAGER_GRAPHQL_URL || 'http://event-manager-backend:4000/graphql';

/** Public origin of Event Manager, for links shown to the user. */
const origin = () =>
  (process.env.EVENT_MANAGER_URL || 'https://events.dantepham.site').replace(/\/$/, '');

export const eventUrl = (eventId: string) => `${origin()}/events/${encodeURIComponent(eventId)}`;

const TIMEOUT_MS = 8000;

export type Participation = 'JOINED' | 'INTERESTED';

export interface EventManagerEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  icon: string | null;
  attendees: { user: { id: string; name: string }; participation: Participation }[];
}

const EVENT_FIELDS = `
  id title description startTime endTime location icon
  attendees { user { id name } participation }
`;

/** An Event Manager failure, shown to the user as a plain message. */
const unavailable = (detail: string) => {
  console.warn(`Event Manager: ${detail}`);
  return new GraphQLError('Could not reach Event Manager. Try again in a moment.', {
    extensions: { code: 'EVENT_MANAGER_UNAVAILABLE' },
  });
};

async function call<T>(token: string, query: string, variables: Record<string, unknown> = {}) {
  let response: Response;
  try {
    response = await fetch(graphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw unavailable(`unreachable: ${(error as Error).message}`);
  }
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  } | null;
  if (body?.errors?.length) throw unavailable(body.errors[0].message);
  if (!response.ok || !body?.data) throw unavailable(`HTTP ${response.status}`);
  return body.data;
}

/** Events the user created or attends, newest first. */
export async function listEvents(token: string): Promise<EventManagerEvent[]> {
  const data = await call<{ getEvents: EventManagerEvent[] }>(
    token,
    `query { getEvents { ${EVENT_FIELDS} } }`,
  );
  return [...data.getEvents].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
}

/** One event the user created or attends, or null when it does not exist or is not theirs. */
export async function getEvent(token: string, id: string): Promise<EventManagerEvent | null> {
  const data = await call<{ getEvent: EventManagerEvent | null }>(
    token,
    `query ($id: ID!) { getEvent(id: $id) { ${EVENT_FIELDS} } }`,
    { id },
  );
  return data.getEvent;
}
