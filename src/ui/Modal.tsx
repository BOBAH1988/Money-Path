import { createPortal } from 'react-dom';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  className?: string;
}

export const Modal = ({ children, onClose, closeOnOverlayClick = true, className = '' }: Props) => {
  let el = document.getElementById('modal-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'modal-root';
    document.body.appendChild(el);
  }

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) onClose();
  };

  return createPortal(
    <div
      className={`modal-overlay ${className}`}
      onClick={handleOverlayClick}
      style={{ position: 'fixed', inset: 0, zIndex: 999 }}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    el
  );
};
