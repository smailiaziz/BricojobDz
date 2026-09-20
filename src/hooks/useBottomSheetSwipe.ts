import React, { useState, useRef, useCallback, useEffect } from 'react';

interface UseBottomSheetSwipeOptions {
  onDismiss: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useBottomSheetSwipe({
  onDismiss,
  threshold = 75,
  enabled = true,
}: UseBottomSheetSwipeOptions) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isEligible = useRef(false);
  const scrollElementRef = useRef<HTMLElement | null>(null);

  // Monitor mobile visualViewport to detect virtual keyboard appearance
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleViewportChange = () => {
      if (window.innerWidth >= 640) {
        setVisualHeight(null);
        setIsKeyboardOpen(false);
        return;
      }

      if (window.visualViewport) {
        const currentVisualHeight = window.visualViewport.height;
        setVisualHeight(currentVisualHeight);
        // Only consider keyboard open if an input/textarea is actively focused and visualViewport shrank
        const isInputFocused = document.activeElement && 
          ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        const keyboardDiff = window.innerHeight - currentVisualHeight;
        setIsKeyboardOpen(Boolean(isInputFocused && keyboardDiff > 150));
      }
    };

    handleViewportChange();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      } else {
        window.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, scrollContainer?: HTMLElement | null) => {
      // Disable swipe down when on desktop or when virtual keyboard is active to avoid accidental dismiss
      if (!enabled || isKeyboardOpen || (typeof window !== 'undefined' && window.innerWidth >= 640)) {
        return;
      }

      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      scrollElementRef.current = scrollContainer || null;

      // Only allow swipe if starting on a non-scrolling element OR if scrollContainer is at top
      if (scrollContainer) {
        isEligible.current = scrollContainer.scrollTop <= 0;
      } else {
        isEligible.current = true;
      }
    },
    [enabled, isKeyboardOpen]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !isEligible.current || isKeyboardOpen || (typeof window !== 'undefined' && window.innerWidth >= 640)) {
        return;
      }

      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = touch.clientX - touchStartX.current;

      // Cancel swipe if scroll container has been scrolled down
      if (scrollElementRef.current && scrollElementRef.current.scrollTop > 0) {
        isEligible.current = false;
        setDragOffsetY(0);
        setIsDragging(false);
        return;
      }

      // Check for predominantly downward swipe (vertical > horizontal)
      if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) * 1.1) {
        setIsDragging(true);
        // Apply smooth resistance damping for natural iOS/Android feel
        const dampedY = deltaY < 150 ? deltaY : 150 + (deltaY - 150) * 0.4;
        setDragOffsetY(dampedY);
      } else if (deltaY < 0 && isDragging) {
        setDragOffsetY(0);
        setIsDragging(false);
      }
    },
    [enabled, isDragging, isKeyboardOpen]
  );

  const handleTouchEnd = useCallback(() => {
    if (!enabled || !isEligible.current || isKeyboardOpen || (typeof window !== 'undefined' && window.innerWidth >= 640)) {
      setDragOffsetY(0);
      setIsDragging(false);
      return;
    }

    if (dragOffsetY >= threshold) {
      onDismiss();
    }

    setDragOffsetY(0);
    setIsDragging(false);
    isEligible.current = false;
  }, [enabled, dragOffsetY, threshold, onDismiss, isKeyboardOpen]);

  // Smoothly scroll active input into visible viewport above keyboard
  const handleFocusIn = useCallback((e: React.FocusEvent) => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }, 220);
      }
    }
  }, []);

  const sheetStyle: React.CSSProperties = {
    ...(dragOffsetY > 0
      ? {
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1)',
        }
      : {
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.9, 0.4, 1)',
        }),
  };

  return {
    dragOffsetY,
    isDragging,
    isKeyboardOpen,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleFocusIn,
    sheetStyle,
  };
}
