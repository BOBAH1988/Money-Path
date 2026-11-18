import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.3;

const mainRoutes = ['/', '/budget', '/assets', '/liabilities', '/income', '/import'];

export function useSwipeNavigation(enabled: boolean = true) {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const isSwiping = useRef(false);

  const currentIndex = useMemo(() => {
    const idx = mainRoutes.indexOf(location.pathname);
    return idx === -1 ? 0 : idx;
  }, [location.pathname]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    isSwiping.current = true;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !isSwiping.current || touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    if (Math.abs(deltaX) < Math.abs(deltaY)) {
      isSwiping.current = false;
      return;
    }

    e.preventDefault();
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !isSwiping.current || touchStartX.current === null || touchStartY.current === null) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const deltaTime = Date.now() - touchStartTime.current;
    const velocity = Math.abs(deltaX) / deltaTime;

    isSwiping.current = false;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < Math.abs(deltaY)) return;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD && velocity < VELOCITY_THRESHOLD) return;

    const totalRoutes = mainRoutes.length;
    if (deltaX > 0) {
      const nextIndex = (currentIndex - 1 + totalRoutes) % totalRoutes;
      navigate(mainRoutes[nextIndex]);
    } else {
      const nextIndex = (currentIndex + 1) % totalRoutes;
      navigate(mainRoutes[nextIndex]);
    }
  }, [enabled, navigate, currentIndex]);

  useEffect(() => {
    if (!enabled) return;

    const content = document.querySelector('.content');
    if (!content) return;

    const onTouchStart = (e: Event) => handleTouchStart(e as TouchEvent);
    const onTouchMove = (e: Event) => handleTouchMove(e as TouchEvent);
    const onTouchEnd = (e: Event) => handleTouchEnd(e as TouchEvent);

    content.addEventListener('touchstart', onTouchStart, { passive: true });
    content.addEventListener('touchmove', onTouchMove, { passive: false });
    content.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      content.removeEventListener('touchstart', onTouchStart);
      content.removeEventListener('touchmove', onTouchMove);
      content.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { currentIndex, totalPages: mainRoutes.length };
}