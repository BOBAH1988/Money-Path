import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { ToastProvider } from './ui/Toast';
import { PageLoader } from './components/PageLoader';
import Dashboard from './pages/Dashboard';
import Budget from './pages/Budget';
import Liabilities from './pages/Liabilities';
import Assets from './pages/Assets';
import Income from './pages/Income';
import Import from './pages/Import';
import IncomeArchive from './pages/IncomeArchive';
import { useAuth } from './context/AuthContext';

function AppRoutes() {
  const { isAuthReady } = useAuth();
  if (!isAuthReady) return <PageLoader fullScreen />;

  return (
    <HashRouter>
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
    </HashRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
