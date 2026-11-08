import { createPortal } from 'react-dom';
import { useEffect, useRef, useCallback } from 'react';

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
  const previousActive = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) onClose();
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  const focusFirstFocusable = useCallback(() => {
    if (!modalRef.current) return;
    const focusable = modalRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();
  }, []);

  const trapFocus = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (!modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || document.activeElement === modalRef.current) {
        e.preventDefault();
        first.focus();
      }
    },
    []
  );

  useEffect(() => {
    previousActive.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', trapFocus);
    requestAnimationFrame(focusFirstFocusable);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', trapFocus);
      if (previousActive.current) {
        previousActive.current.focus();
      }
    };
  }, [handleKeyDown, trapFocus, focusFirstFocusable]);

  return createPortal(
    <div
      ref={modalRef}
      className={`modal-overlay ${className}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 999 }}
    >
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    el
  );
};
