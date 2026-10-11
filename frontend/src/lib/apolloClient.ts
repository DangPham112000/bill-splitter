import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

// Same-origin in every environment: Vite proxies /graphql in dev, nginx in production.
export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: '/graphql' }),
  cache: new InMemoryCache(),
});
