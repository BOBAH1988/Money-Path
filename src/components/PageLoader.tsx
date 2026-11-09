export function PageLoader({ text = 'Загрузка…', fullScreen = false }: { text?: string; fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <div className="page-loader page-loader-fullscreen" role="status" aria-live="polite">
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
