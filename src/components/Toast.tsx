import { IoCheckmarkCircle, IoClose, IoCloseCircle, IoInformationCircle } from 'react-icons/io5';
import type { ToastType } from '../types/toast';

type ToastProps = {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
};

const toastConfig: Record<ToastType, { className: string; icon: React.ReactNode }> = {
  success: {
    className: 'toast--success',
    icon: <IoCheckmarkCircle size={22} />,
  },
  error: {
    className: 'toast--error',
    icon: <IoCloseCircle size={22} />,
  },
  info: {
    className: 'toast--info',
    icon: <IoInformationCircle size={22} />,
  },
};

export default function Toast({ message, type, visible, onHide }: ToastProps) {
  if (!visible || !message) return null;

  const cfg = toastConfig[type];

  return (
    <div className="toast-overlay" role="status" aria-live="polite">
      <div className={`toast ${cfg.className}`}>
        <span className="toast-icon">{cfg.icon}</span>
        <span className="toast-message">{message}</span>
        <button className="toast-close" type="button" onClick={onHide} aria-label="Fechar notificação">
          <IoClose size={18} />
        </button>
      </div>
    </div>
  );
}
