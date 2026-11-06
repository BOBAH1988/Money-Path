import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Budget from './pages/Budget';
import Liabilities from './pages/Liabilities';
import Assets from './pages/Assets';
import Income from './pages/Income';
import IncomeArchive from './pages/IncomeArchive';

export default function App() {
  return (
    <BrowserRouter basename="/Money-Path/">
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
    </BrowserRouter>
  );
}
