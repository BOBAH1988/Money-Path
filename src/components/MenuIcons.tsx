import type { ReactNode } from 'react';

type IconName =
  | 'dashboard'
  | 'budget'
  | 'assets'
  | 'liabilities'
  | 'income'
  | 'import'
  | 'export'
  | 'archive'
  | 'refresh'
  | 'theme'
  | 'reset'
  | 'install'
  | 'account'
  | 'user';

const paths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  budget: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v1" />
      <rect x="4" y="7.5" width="16" height="11.5" rx="2.5" />
      <path d="M16 13.25h2.2" />
    </>
  ),
  assets: (
    <>
      <path d="M4 17.5V13" />
      <path d="M9.3 17.5V9.5" />
      <path d="M14.6 17.5V11" />
      <path d="M20 17.5V5.5" />
    </>
  ),
  liabilities: (
    <>
      <path d="M12 4.5 20 8.5 12 12.5 4 8.5Z" />
      <path d="M4 12.5 12 16.5 20 12.5" />
      <path d="M4 16.5 12 20.5 20 16.5" />
    </>
  ),
  income: (
    <>
      <rect x="3.5" y="6.5" width="17" height="11" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7 10v4M17 10v4" />
    </>
  ),
  import: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 17.5v1A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2v-1" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4.5 17.5v1A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2v-1" />
    </>
  ),
  archive: (
    <>
      <path d="M3.5 7.5h17v3h-17z" />
      <path d="M5 10.5v8a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-8" />
      <path d="M9.5 14.5h5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4.5V10h-5.5" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4.5V10h5.5" />
    </>
  ),
  install: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M12 7v6" />
      <path d="m9.5 10.5 2.5 2.5 2.5-2.5" />
      <path d="M10.5 18h3" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8.5" r="3.7" />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.7" />
      <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
    </>
  ),
};

export const MenuIcon = ({ name }: { name: IconName }) => (
  <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    {paths[name]}
  </svg>
);

export type { IconName };
