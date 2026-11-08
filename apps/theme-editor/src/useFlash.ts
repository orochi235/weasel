import { useCallback, useEffect, useRef, useState } from 'react';

/** A value that `flash(v)` shows for `ms` and then returns to `idle`. A flash during a flash restarts
 *  the wait, and unmounting cancels it. */
export function useFlash<T>(idle: T, ms: number): [T, (value: T) => void] {
  const [value, setValue] = useState(idle);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback(
    (next: T) => {
      window.clearTimeout(timer.current);
      setValue(next);
      timer.current = window.setTimeout(() => setValue(idle), ms);
    },
    [idle, ms],
  );
  return [value, flash];
}
