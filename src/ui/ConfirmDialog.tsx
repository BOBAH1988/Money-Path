import { Button } from './Button';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'secondary';
}

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  confirmVariant = 'danger',
}: Props) => {
  if (!open) return null;

  return (
    <Modal onClose={onClose} closeOnOverlayClick>
      <h2 className="confirm-title">{title}</h2>
      {description && <p className="confirm-description">{description}</p>}
      <div className="confirm-actions">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
