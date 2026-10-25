import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloProvider } from '@apollo/client/react';
import { ClerkProvider } from '@clerk/react';
import { apolloClient } from './lib/apolloClient';
import { authEnabled, clerkPublishableKey } from './lib/auth';
import App from './App';
import './index.css';

const app = (
  <ApolloProvider client={apolloClient}>
    <App />
  </ApolloProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {authEnabled ? (
      // Shared Clerk app: one session across every *.dantepham.site app.
      <ClerkProvider publishableKey={clerkPublishableKey!}>{app}</ClerkProvider>
    ) : (
      app
    )}
  </StrictMode>,
);
