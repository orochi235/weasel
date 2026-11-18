import { useLatest } from '@weasel-js/core';
import { useCallback, useEffect, useRef } from 'react';
import type { LoupeLens } from './types';

/** Tell `onLens` the lens that shows, or null, on a change in value rather than on every render: a host drawing
 *  into this box would otherwise redraw for each one. Unmounting reports null. */
export function useLensReport(
  onLens: ((lens: LoupeLens | null) => void) | undefined,
  shownLens: LoupeLens | null,
): void {
  const onLensRef = useLatest(onLens);
  const reportedRef = useRef<string>(JSON.stringify(null));
  const report = useCallback(
    (next: LoupeLens | null): void => {
      const key = JSON.stringify(next);
      if (key === reportedRef.current) return;
      reportedRef.current = key;
      onLensRef.current?.(next);
    },
    [onLensRef],
  );
  const shownKey = JSON.stringify(shownLens);
  useEffect(() => {
    report(JSON.parse(shownKey) as LoupeLens | null);
  }, [shownKey, report]);
  useEffect(() => () => report(null), [report]);
}
