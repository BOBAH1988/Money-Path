import { useEffect } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';

export default function Import() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Импорт');
  }, [setPageTitle]);

  return <div className="page"><h1>Import</h1><p>Заглушка</p></div>;
}
