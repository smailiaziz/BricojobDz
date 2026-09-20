import { useState, useEffect, useCallback } from 'react';
import { isDesktopDevice } from '../domain';
import { desktopRestrictionRepository } from '../repositories';

export function useDesktopRestriction() {
  const [isDesktopBlocked, setIsDesktopBlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    return isDesktopDevice(ua, navigator.maxTouchPoints || 0, window.innerWidth);
  });

  const [bypassedDesktopRestriction, setBypassedDesktopRestriction] = useState<boolean>(() => {
    return desktopRestrictionRepository.isBypassed();
  });

  const bypassDesktop = useCallback(() => {
    setBypassedDesktopRestriction(true);
    desktopRestrictionRepository.setBypassed(true);
  }, []);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      setIsDesktopBlocked(isDesktopDevice(ua, navigator.maxTouchPoints || 0, window.innerWidth));
    };

    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return {
    isDesktopBlocked,
    bypassedDesktopRestriction,
    bypassDesktop,
  };
}
