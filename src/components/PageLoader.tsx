import type { CSSProperties } from 'react';
import siteIconUrl from '../assets/site-icon.svg?url';

export function PageLoader({ text = 'Загрузка…', fullScreen = false }: { text?: string; fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <div className="page-loader page-loader-fullscreen" role="status" aria-live="polite">
        <div
          className="page-loader-icon"
          style={{
            background: `linear-gradient(135deg, var(--dp-color-primary, #007aff), var(--dp-color-primary-hover, #5856d6))`,
            '--dp-icon-src': siteIconUrl as unknown as string,
          } as CSSProperties}
        >
          <div className="page-loader-icon-bg"></div>
          <div className="page-loader-icon-img"></div>
        </div>
        <div className="page-loader-spinner" aria-hidden="true" />
        <span className="page-loader-text">{text}</span>
      </div>
    );
  }
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-spinner" aria-hidden="true" />
      <span className="page-loader-text">{text}</span>
    </div>
  );
}
