import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './ui/Toast';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Budget = lazy(() => import('./pages/Budget'));
const Liabilities = lazy(() => import('./pages/Liabilities'));
const Assets = lazy(() => import('./pages/Assets'));
const Income = lazy(() => import('./pages/Income'));
const Import = lazy(() => import('./pages/Import'));
const IncomeArchive = lazy(() => import('./pages/IncomeArchive'));

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename="/Money-Path/">
          <Suspense fallback={<div className="page">Загрузка…</div>}>
            <Routes>
              <Route element={<ErrorBoundary><Layout /></ErrorBoundary>}>
                <Route
                  path="/"
                  element={
                    <ErrorBoundary>
                      <Dashboard />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/import"
                  element={
                    <ErrorBoundary>
                      <Import />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/budget"
                  element={
                    <ErrorBoundary>
                      <Budget />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/assets"
                  element={
                    <ErrorBoundary>
                      <Assets />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/liabilities"
                  element={
                    <ErrorBoundary>
                      <Liabilities />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/income"
                  element={
                    <ErrorBoundary>
                      <Income />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/income-archive"
                  element={
                    <ErrorBoundary>
                      <IncomeArchive />
                    </ErrorBoundary>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
