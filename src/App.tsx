import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Import from './pages/Import';
import Budget from './pages/Budget';
import Liabilities from './pages/Liabilities';
import Assets from './pages/Assets';
import Income from './pages/Income';
import IncomeArchive from './pages/IncomeArchive';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './ui/Toast';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <ErrorBoundary>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/import" element={<Import />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/liabilities" element={<Liabilities />} />
                <Route path="/income" element={<Income />} />
                <Route path="/income-archive" element={<IncomeArchive />} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
