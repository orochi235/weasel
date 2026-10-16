import { useEffect } from 'react';

/** Close on a press or wheel outside every panel, on window blur and on resize. */
export function useDismiss(isInside: (target: EventTarget | null) => boolean, close: () => void): void {
  useEffect(() => {
    const outside = (e: Event) => { if (!isInside(e.target)) close(); };
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('wheel', outside, { capture: true, passive: true });
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('wheel', outside, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [isInside, close]);
}
