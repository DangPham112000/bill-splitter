import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { getToken } from '@clerk/react';
import { authEnabled } from './auth';
import { getDeviceId } from './device';

// Same-origin in every environment: Vite proxies /graphql in dev, nginx in production.
const httpLink = new HttpLink({ uri: '/graphql' });

// Sends the Clerk session token when signed in. Signed-out requests go out without it.
const authLink = new SetContextLink(async (prevContext) => {
  const token = authEnabled ? await getToken() : null;
  if (!token) return {};
  return { headers: { ...prevContext.headers, Authorization: `Bearer ${token}` } };
});

// Every request says which device it comes from (DAN-30); edit rights are bound to it.
const deviceLink = new SetContextLink((prevContext) => ({
  headers: { ...prevContext.headers, 'X-Device-Id': getDeviceId() },
}));

export const apolloClient = new ApolloClient({
  link: deviceLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
});
