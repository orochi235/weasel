import { useEffect, useState } from 'react';

/**
 * What `load(arg)` resolves to: `null` while it is pending, `'failed'` when it
 * rejected. The value is not cleared when `arg` changes, so a caller showing
 * one thing per `arg` keys its component by it.
 */
export function useLoaded<A, T>(load: (arg: A) => Promise<T>, arg: A): T | null | 'failed' {
  const [value, setValue] = useState<T | null | 'failed'>(null);
  useEffect(() => {
    let live = true;
    load(arg).then(
      (loaded) => { if (live) setValue(loaded); },
      () => { if (live) setValue('failed'); },
    );
    return () => { live = false; };
  }, [load, arg]);
  return value;
}
