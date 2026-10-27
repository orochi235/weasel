import { useEffect } from 'react';

/** Close on a press or wheel outside every panel, on window blur and on resize. A blur while a color input
 *  inside the menu has focus is kept open. */
export function useDismiss(isInside: (target: EventTarget | null) => boolean, close: () => void): void {
  useEffect(() => {
    const outside = (e: Event) => { if (!isInside(e.target)) close(); };
    // A native color picker can take focus from the window while its input keeps it.
    const blur = () => {
      const at = document.activeElement;
      if (!(at instanceof HTMLInputElement && at.type === 'color' && isInside(at))) close();
    };
    window.addEventListener('pointerdown', outside, true);
    window.addEventListener('wheel', outside, { capture: true, passive: true });
    window.addEventListener('blur', blur);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('wheel', outside, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', close);
    };
  }, [isInside, close]);
}
