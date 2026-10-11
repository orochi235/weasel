import { useEffect, useRef, type RefObject } from 'react';
import { useLatest } from '@weasel-js/core';

/**
 * Calls `onClose` when a native color input's picker closes; attach the
 * returned ref to the input.
 *
 * The picker closing fires a native `change`, which React's `onChange` does
 * not deliver apart from `input`; the input can keep focus after it closes,
 * so waiting for blur alone would hold a commit until the next click.
 */
export function usePickerClose(onClose: () => void): RefObject<HTMLInputElement | null> {
  const input = useRef<HTMLInputElement>(null);
  const latest = useLatest(onClose);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const fire = (): void => latest.current();
    el.addEventListener('change', fire);
    return () => el.removeEventListener('change', fire);
  }, [latest]);
  return input;
}
