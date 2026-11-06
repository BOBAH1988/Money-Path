import { useEffect } from 'react';
import { useContext } from 'react';
import { PageTitleContext } from '../components/Layout';

export default function Categories() {
  const { setPageTitle } = useContext(PageTitleContext)!;

  useEffect(() => {
    setPageTitle('Категории');
  }, [setPageTitle]);

  return <div className="page"><h1>Categories</h1><p>Заглушка</p></div>;
}
