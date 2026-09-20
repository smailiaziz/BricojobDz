import { useState, useRef, useEffect, useCallback } from 'react';
import { ToastMessage } from '../types';

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    // Deduplication: if identical notification is already active, refresh timer
    setToast(prev => {
      if (prev && prev.text === text && prev.type === type) {
        return prev;
      }
      return { id: String(Date.now()), text, type };
    });

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const closeToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return {
    toast,
    showToast,
    closeToast,
  };
}
