import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Toast from '../components/Toast';
import type { ToastType } from '../types/toast';

type ShowToastFn = (message: string, type?: ToastType, duration?: number) => void;

type GlobalToastEventDetail = {
  message: string;
  type?: ToastType;
  duration?: number;
};

type ToastContextType = {
  showToast: ShowToastFn;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const [duration, setDuration] = useState(3000);

  const hide = useCallback(() => setVisible(false), []);

  const showToast: ShowToastFn = useCallback((msg, variant = 'info', timeout = 3000) => {
    setMessage(msg);
    setType(variant);
    setDuration(timeout);
    setVisible(true);
  }, []);

  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const customEvent = event as CustomEvent<GlobalToastEventDetail>;
      const detail = customEvent.detail;
      if (!detail?.message) return;
      showToast(detail.message, detail.type ?? 'info', detail.duration ?? 3000);
    };

    window.addEventListener('qserpx:toast', handleGlobalToast as EventListener);
    return () => window.removeEventListener('qserpx:toast', handleGlobalToast as EventListener);
  }, [showToast]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [visible, duration]);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Toast message={message} type={type} visible={visible} onHide={hide} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
