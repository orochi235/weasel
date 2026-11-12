import { isEditableTarget } from '@weasel-js/gestures';
import { useEffect } from 'react';

/** Opens the palette on `/`, except while typing in a field. */
export function useCommandPaletteShortcut(open: boolean, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
}
