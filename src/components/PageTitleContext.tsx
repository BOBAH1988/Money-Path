import { createContext, type ReactNode, useState } from 'react';

interface PageTitleContextValue {
  pageTitle: string;
  setPageTitle: (title: string) => void;
}

export const PageTitleContext = createContext<PageTitleContextValue | undefined>(undefined);

interface PageTitleProviderProps {
  children: ReactNode;
}

export const PageTitleProvider = ({ children }: PageTitleProviderProps) => {
  const [pageTitle, setPageTitle] = useState('');
  const ctxValue = { pageTitle, setPageTitle };

  return (
    <PageTitleContext.Provider value={ctxValue}>
      {children}
    </PageTitleContext.Provider>
  );
};
