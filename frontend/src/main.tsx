import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloProvider } from '@apollo/client/react';
import { BrowserRouter } from 'react-router';
import { apolloClient } from './lib/apolloClient';
import { DeviceProvider } from './components/DeviceProvider';
import { ClerkWithRouter } from './components/ClerkWithRouter';
import { authEnabled } from './lib/auth';
import App from './App';
import './index.css';

const app = (
  <ApolloProvider client={apolloClient}>
    <DeviceProvider>
      <App />
    </DeviceProvider>
  </ApolloProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>{authEnabled ? <ClerkWithRouter>{app}</ClerkWithRouter> : app}</BrowserRouter>
  </StrictMode>,
);
