import { useCallback, useEffect, useRef, useState } from 'react';
import { after } from '@weasel-js/registry';

/** A value that `flash(v)` shows for `ms` and then returns to `idle`. A flash during a flash restarts
 *  the wait, and unmounting cancels it; a flash after unmount does nothing. */
export function useFlash<T>(idle: T, ms: number): [T, (value: T) => void] {
  const [value, setValue] = useState(idle);
  const cancel = useRef<() => void>(() => {});
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel.current();
    };
  }, []);
  const flash = useCallback(
    (next: T) => {
      if (!mounted.current) return;
      cancel.current();
      setValue(next);
      cancel.current = after(ms, () => setValue(idle));
    },
    [idle, ms],
  );
  return [value, flash];
}
