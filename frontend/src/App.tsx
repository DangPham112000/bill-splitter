import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CreateSplitterPage } from './pages/CreateSplitterPage';
import { SplitterPage } from './pages/SplitterPage';
import { EditSplitterPage } from './pages/EditSplitterPage';
import { EventSplitterPage } from './pages/EventSplitterPage';
import { JoinPage } from './pages/JoinPage';
import { Card, EmptyState } from './components/ui';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="new" element={<CreateSplitterPage />} />
          <Route path="s/:id" element={<SplitterPage />} />
          <Route path="s/:id/edit" element={<EditSplitterPage />} />
          <Route path="join/:token" element={<JoinPage />} />
          <Route path="events/:eventId" element={<EventSplitterPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
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
