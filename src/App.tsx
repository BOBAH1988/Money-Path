import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { ToastProvider } from './ui/Toast';
import { PageLoader } from './components/PageLoader';
import { ErrorBoundary } from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Budget = lazy(() => import('./pages/Budget'));
const Liabilities = lazy(() => import('./pages/Liabilities'));
const Assets = lazy(() => import('./pages/Assets'));
const Income = lazy(() => import('./pages/Income'));
const Import = lazy(() => import('./pages/Import'));
const IncomeArchive = lazy(() => import('./pages/IncomeArchive'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

function AppRoutes() {
  return (
    <HashRouter>
      <Suspense fallback={<PageLoader fullScreen />}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<Import />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/liabilities" element={<Liabilities />} />
            <Route path="/income" element={<Income />} />
            <Route path="/income-archive" element={<IncomeArchive />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="app-error-screen" role="alert">
          <h1>Не удалось загрузить приложение</h1>
          <p>Проверьте подключение к интернету и попробуйте перезагрузить страницу.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Перезагрузить приложение
          </button>
        </div>
      )}
    >
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
