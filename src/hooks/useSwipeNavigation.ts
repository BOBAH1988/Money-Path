import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Порог по расстоянию берётся как доля ширины экрана, но не меньше минимума:
// на узком телефоне фиксированные пиксели означают слишком длинный жест.
const MIN_SWIPE_DISTANCE = 56;
const SWIPE_SCREEN_RATIO = 0.18;
const VELOCITY_THRESHOLD = 0.35;
// Пока палец двигается меньше, мы не решаем, жест горизонтальный: пауза
// в начале касания не должна превращать вертикальный скролл в переключение.
const DIRECTION_LOCK_DISTANCE = 10;
// Сколько миллисекунд после движения не считать касание свайпом:
// защита от случайного перетаскивания при прокрутке таблиц.
const MAX_GESTURE_DURATION = 1200;

const mainRoutes = ['/', '/budget', '/assets', '/liabilities', '/income', '/import'];

const hasHorizontalScroller = (target: Element | null, root: Element): boolean => {
  let node: Element | null = target;
  while (node && node !== root) {
    const style = window.getComputedStyle(node);
    const canScrollX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 1;
    if (canScrollX) return true;
    // Карусели и слайдеры помечаются атрибутом: внутри них свайп не перехватываем.
    if (node.hasAttribute('data-swipe-ignore')) return true;
    node = node.parentElement;
  }
  return false;
};

const isEditable = (target: Element | null): boolean =>
  !!target?.closest('input, textarea, select, [contenteditable="true"]');

export function useSwipeNavigation(enabled: boolean = true) {
  const location = useLocation();
  const navigate = useNavigate();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef(0);
  const axis = useRef<'none' | 'horizontal' | 'vertical'>('none');
  const blocked = useRef(false);

  const currentIndex = useMemo(() => {
    const idx = mainRoutes.indexOf(location.pathname);
    return idx === -1 ? 0 : idx;
  }, [location.pathname]);

  const reset = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
    axis.current = 'none';
    blocked.current = false;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      reset();
      if (e.touches.length !== 1) {
        blocked.current = true;
        return;
      }
      if (isEditable(e.target as Element | null)) {
        blocked.current = true;
        return;
      }

      const container = e.currentTarget as Element | null;
      if (container && hasHorizontalScroller(e.target as Element | null, container)) {
        blocked.current = true;
        return;
      }

      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchStartTime.current = Date.now();
    },
    [enabled, reset],
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || blocked.current) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    if (e.touches.length !== 1) {
      blocked.current = true;
      return;
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    if (axis.current === 'none') {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DIRECTION_LOCK_DISTANCE) return;
      axis.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      if (axis.current === 'vertical') return;
    }

    // Вертикальная прокрутка остаётся браузеру: касание не считается свайпом.
    if (axis.current === 'vertical') {
      blocked.current = true;
      return;
    }

    // Горизонтальный жест принадлежит нам: гасим прокрутку по X,
    // чтобы страница не «дёргалась» вбок во время переключения.
    if (e.cancelable) e.preventDefault();
  }, [enabled]);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || blocked.current) {
        reset();
        return;
      }
      if (touchStartX.current === null || touchStartY.current === null) {
        reset();
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;
      const deltaTime = Math.max(Date.now() - touchStartTime.current, 1);

      const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
      const wasHorizontal = axis.current === 'horizontal';
      const distance = Math.abs(deltaX);
      const threshold = Math.min(
        Math.max(window.innerWidth * SWIPE_SCREEN_RATIO, MIN_SWIPE_DISTANCE),
        window.innerWidth * 0.4,
      );
      const velocity = distance / deltaTime;

      reset();

      if (!horizontal || !wasHorizontal) return;
      if (deltaTime > MAX_GESTURE_DURATION) return;
      // Далеко и медленно — тоже свайп, не только «бросок» пальцем.
      if (distance < threshold && velocity < VELOCITY_THRESHOLD) return;

      const totalRoutes = mainRoutes.length;
      const nextIndex =
        deltaX > 0
          ? (currentIndex - 1 + totalRoutes) % totalRoutes
          : (currentIndex + 1) % totalRoutes;
      navigate(mainRoutes[nextIndex]);
    },
    [enabled, navigate, currentIndex, reset],
  );

  useEffect(() => {
    if (!enabled) return;

    const content = document.querySelector('.content');
    if (!content) return;

    const onTouchStart = (e: Event) => handleTouchStart(e as TouchEvent);
    const onTouchMove = (e: Event) => handleTouchMove(e as TouchEvent);
    const onTouchEnd = (e: Event) => handleTouchEnd(e as TouchEvent);
    // Системный жест прерывает касание: без этого следующее движение читается
    // как продолжение старого свайпа.
    const onTouchCancel = () => reset();

    content.addEventListener('touchstart', onTouchStart, { passive: true });
    content.addEventListener('touchmove', onTouchMove, { passive: false });
    content.addEventListener('touchend', onTouchEnd, { passive: true });
    content.addEventListener('touchcancel', onTouchCancel);

    return () => {
      content.removeEventListener('touchstart', onTouchStart);
      content.removeEventListener('touchmove', onTouchMove);
      content.removeEventListener('touchend', onTouchEnd);
      content.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, reset]);

  return { currentIndex, totalPages: mainRoutes.length };
}
