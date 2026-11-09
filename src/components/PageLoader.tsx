export function PageLoader({ text = 'Загрузка…' }: { text?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-spinner" aria-hidden="true" />
      <span className="page-loader-text">{text}</span>
    </div>
  );
}
