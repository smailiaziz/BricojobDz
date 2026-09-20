import { useState, useEffect, useCallback } from 'react';
import { 
  isStandaloneMode, 
  isPwaDismissedInCooldown, 
  recordPwaDismissal, 
  isIOSDevice 
} from '../domain/pwa';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface UsePwaInstallPromptResult {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  showBanner: boolean;
  promptInstall: () => Promise<boolean>;
  dismissBanner: () => void;
  showIOSGuide: boolean;
  setShowIOSGuide: (show: boolean) => void;
}

const DEFAULT_BANNER_DELAY_MS = 10000; // 10 seconds polite delay

export function usePwaInstallPrompt(delayMs: number = DEFAULT_BANNER_DELAY_MS): UsePwaInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneMode());
  const [isIOS, setIsIOS] = useState<boolean>(() => isIOSDevice());
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial standalone state check
    const checkStandalone = () => {
      const standalone = isStandaloneMode();
      setIsInstalled(standalone);
      if (standalone) {
        setShowBanner(false);
      }
    };
    checkStandalone();

    // 2. iOS Detection
    setIsIOS(isIOSDevice());

    // 3. Media query listener for display-mode changes
    let mediaQuery: MediaQueryList | null = null;
    try {
      if (window.matchMedia) {
        mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleMediaChange = (e: MediaQueryListEvent) => {
          if (e.matches) {
            setIsInstalled(true);
            setShowBanner(false);
          }
        };
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', handleMediaChange);
        }
      }
    } catch {
      // Ignore media query errors in mock environments
    }

    // 4. Handle beforeinstallprompt
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser prompt
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Check if installed or dismissed
      if (!isStandaloneMode() && !isPwaDismissedInCooldown()) {
        timerId = setTimeout(() => {
          setShowBanner(true);
        }, delayMs);
      }
    };

    // 5. Handle appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [delayMs]);

  // Handle user clicking "تثبيت التطبيق"
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setShowBanner(false);

        if (choice && choice.outcome === 'accepted') {
          setIsInstalled(true);
          return true;
        } else {
          recordPwaDismissal();
          return false;
        }
      } catch {
        recordPwaDismissal();
        setShowBanner(false);
        return false;
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
      return false;
    }
    return false;
  }, [deferredPrompt, isIOS]);

  // Handle user clicking "ليس الآن"
  const dismissBanner = useCallback(() => {
    recordPwaDismissal();
    setShowBanner(false);
  }, []);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    showBanner,
    promptInstall,
    dismissBanner,
    showIOSGuide,
    setShowIOSGuide,
  };
}
