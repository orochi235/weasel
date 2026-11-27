import { useState } from 'react';

/** The traced key and its setter: `traced` when the caller controls it, the chart's own otherwise; `onTrace` hears
 *  every change either way. */
export function useTrace(traced: string | null | undefined, onTrace: ((key: string | null) => void) | undefined) {
  const [own, setOwn] = useState<string | null>(null);
  const controlled = traced !== undefined;
  const set = (key: string | null): void => {
    if (!controlled) setOwn(key);
    onTrace?.(key);
  };
  return [controlled ? traced : own, set] as const;
}
