import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Budget from './pages/Budget';
import Liabilities from './pages/Liabilities';
import Assets from './pages/Assets';
import Income from './pages/Income';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './ui/Toast';
import Dashboard from './pages/Dashboard';

const Import = lazy(() => import('./pages/Import'));
const IncomeArchive = lazy(() => import('./pages/IncomeArchive'));

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename="/Money-Path/">
          <ErrorBoundary>
            <Suspense fallback={<div className="page">Загрузка…</div>}>
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
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
