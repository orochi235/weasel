import { useEffect } from 'react';
import { attachMenuDismiss } from '@weasel-js/menu';

/** Close on a press or wheel outside every panel, on window blur and on resize. A blur while a color input
 *  inside the menu has focus is kept open. A field inside the menu that has focus is blurred first, so it keeps
 *  what was typed into it. */
export function useDismiss(isInside: (target: EventTarget | null) => boolean, close: () => void): void {
  useEffect(() => attachMenuDismiss<Event>(window, {
    outside: (e) => !isInside(e.target),
    close: () => {
      const at = document.activeElement;
      if (at instanceof HTMLElement && isInside(at)) at.blur();
      close();
    },
    // A native color picker can take focus from the window while its input keeps it.
    keepOnBlur: () => {
      const at = document.activeElement;
      return at instanceof HTMLInputElement && at.type === 'color' && isInside(at);
    },
  }), [isInside, close]);
}
