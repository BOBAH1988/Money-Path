export function PageLoader({ text = 'Загрузка…', fullScreen = false }: { text?: string; fullScreen?: boolean }) {
  return (
    <div className={`page-loader${fullScreen ? ' page-loader-fullscreen' : ''}`} role="status" aria-live="polite">
      <div className="page-loader-spinner" aria-hidden="true" />
      <span className="page-loader-text">{text}</span>
    </div>
  );
}
