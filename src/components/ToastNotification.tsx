import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastNotificationProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  const typeStyles = {
    success: 'bg-stone-900/95 text-white border-emerald-500/30',
    error: 'bg-rose-950/95 text-white border-rose-500/30',
    warning: 'bg-stone-900/95 text-white border-amber-500/40',
    info: 'bg-stone-900/95 text-white border-stone-700/50',
  }[toast.type || 'info'];

  return (
    <div 
      id="toast-notification"
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)] w-auto animate-bounce-in font-['Cairo',sans-serif] pointer-events-none"
      dir="rtl"
    >
      <div className={`px-4 py-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.18)] border flex items-center justify-between gap-3 text-xs font-black backdrop-blur-xl pointer-events-auto ${typeStyles}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
          <span className="leading-snug">{toast.text}</span>
        </div>
        <button 
          id="toast-close-btn"
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-white/60 hover:text-white shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
          aria-label="إغلاق التنبيه"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
