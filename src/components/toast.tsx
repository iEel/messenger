'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';

// ============================================================
// Toast Types
// ============================================================
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ToastContextType {
  toast: {
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================================
// Hook
// ============================================================
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within <ToastProvider>');
  return context;
}

// ============================================================
// Provider + UI
// ============================================================
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const counterRef = useRef(0);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 3000) => {
    const id = `toast-${++counterRef.current}`;
    setToasts(prev => [...prev, { id, type, title, message, duration }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (title: string, message?: string) => addToast('success', title, message),
    error: (title: string, message?: string) => addToast('error', title, message, 5000),
    warning: (title: string, message?: string) => addToast('warning', title, message, 4000),
    info: (title: string, message?: string) => addToast('info', title, message),
  };

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle size={18} />,
    error: <XCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  const colors: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  const confirmColors = {
    danger: 'from-red-600 to-red-700 shadow-red-500/25',
    warning: 'from-amber-600 to-amber-700 shadow-amber-500/25',
    info: 'from-primary-600 to-primary-700 shadow-primary-500/25',
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: '360px' }}>
        {toasts.map((t) => (
          <div key={t.id}
            className="pointer-events-auto animate-slide-in-right
                       bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200 dark:border-surface-700
                       flex items-start gap-3 p-4 min-w-[280px]">
            <div className={`shrink-0 w-8 h-8 rounded-lg ${colors[t.type]} text-white flex items-center justify-center`}>
              {icons[t.type]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-800 dark:text-white">{t.title}</p>
              {t.message && (
                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-2">{t.message}</p>
              )}
            </div>
            <button onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 cursor-pointer">
              <X size={14} className="text-surface-400" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => handleConfirm(false)} />
          <div className="relative bg-white dark:bg-surface-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-fade-in">
            <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white
              ${confirmState.options.type === 'danger' ? 'bg-red-500' :
                confirmState.options.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}>
              {confirmState.options.type === 'danger' ? <AlertTriangle size={24} /> :
               confirmState.options.type === 'warning' ? <AlertTriangle size={24} /> :
               <Info size={24} />}
            </div>
            <h3 className="text-lg font-bold text-surface-800 dark:text-white mb-2">
              {confirmState.options.title}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-6 whitespace-pre-line">
              {confirmState.options.message}
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400
                           hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors cursor-pointer">
                {confirmState.options.cancelText || 'ยกเลิก'}
              </button>
              <button onClick={() => handleConfirm(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                           bg-gradient-to-r ${confirmColors[confirmState.options.type || 'info']}
                           shadow-lg transition-all cursor-pointer`}>
                {confirmState.options.confirmText || 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

    </ToastContext.Provider>
  );
}
