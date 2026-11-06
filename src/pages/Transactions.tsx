import { useEffect } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';

export default function Transactions() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Транзакции');
  }, [setPageTitle]);

  return <div className="page"><h1>Transactions</h1><p>Заглушка</p></div>;
}
