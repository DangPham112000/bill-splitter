import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CreateSplitterPage } from './pages/CreateSplitterPage';
import { SplitterPage } from './pages/SplitterPage';
import { EditSplitterPage } from './pages/EditSplitterPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="new" element={<CreateSplitterPage />} />
          <Route path="s/:id" element={<SplitterPage />} />
          <Route path="s/:id/edit" element={<EditSplitterPage />} />
          <Route path="*" element={<p className="pt-6 text-slate-600">Page not found.</p>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
