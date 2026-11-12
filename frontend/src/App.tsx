import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CreateSplitterPage } from './pages/CreateSplitterPage';
import { SplitterPage } from './pages/SplitterPage';
import { EditSplitterPage } from './pages/EditSplitterPage';
import { AddExpensePage } from './pages/AddExpensePage';
import { EventSplitterPage } from './pages/EventSplitterPage';
import { JoinPage } from './pages/JoinPage';
import { SignInPage } from './pages/SignInPage';
import { authEnabled } from './lib/auth';
import { Card, EmptyState } from './components/ui';

export default function App() {
  return (
    <Routes>
      {authEnabled && <Route path="sign-in/*" element={<SignInPage mode="sign-in" />} />}
      {authEnabled && <Route path="sign-up/*" element={<SignInPage mode="sign-up" />} />}
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="new" element={<CreateSplitterPage />} />
        <Route path="s/:id" element={<SplitterPage />} />
        <Route path="s/:id/edit" element={<EditSplitterPage />} />
        <Route path="s/:id/expenses/new" element={<AddExpensePage />} />
        <Route path="join/:token" element={<JoinPage />} />
        <Route path="events/:eventId" element={<EventSplitterPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <Card>
      <EmptyState icon="🧭" title="Page not found">
        This address does not lead anywhere. Check the link or go back to your splitters.
      </EmptyState>
    </Card>
  );
}
