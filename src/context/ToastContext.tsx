import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import styles from '../components/Toast.module.css';

const ToastContext = createContext<(msg: string) => void>(() => {});
const ToastStateContext = createContext<{ msg: string; show: boolean }>({ msg: '', show: false });

export function useToast() {
  return useContext(ToastContext);
}

function useToastState() {
  return useContext(ToastStateContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((next: string) => {
    setMsg(next);
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      <ToastStateContext.Provider value={{ msg, show }}>{children}</ToastStateContext.Provider>
    </ToastContext.Provider>
  );
}

export function ToastViewport() {
  const { msg, show } = useToastState();
  return <div className={`${styles.toast} ${show ? styles.toastShow : ''}`}>{msg}</div>;
}
