import { useEffect } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';

export default function Dashboard() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Дашборд');
  }, [setPageTitle]);

  return <div className="page"><h1>Dashboard</h1><p>Заглушка</p></div>;
}
