import { useRef } from 'react';
import { GESTURE_MS } from '../trial/writeGesture';

/** Counts bursts for every gesture source at once, so a key handed out is never handed out again:
 *  a palette or a list that remounts cannot hand a new burst the key of an old step it would fold into. */
let bursts = 0;

/** The coalesce key for each write of a burst: writes to one `field` of one `scope` within
 *  `GESTURE_MS` of each other share a key, and so are one undo step. */
export function createMarkGesture(prefix: string): (field: string, scope: string) => string {
  let last: { field: string; scope: string; at: number; key: string } | null = null;
  return (field, scope) => {
    const now = Date.now();
    const gap = last ? now - last.at : Infinity;
    const same =
      last !== null && last.field === field && last.scope === scope && gap >= 0 && gap < GESTURE_MS;
    const key = same && last ? last.key : `${prefix}:${++bursts}`;
    last = { field, scope, at: now, key };
    return key;
  };
}

/** `createMarkGesture` for a component's life. */
export function useMarkGesture(prefix: string): (field: string, scope: string) => string {
  const gesture = useRef<((field: string, scope: string) => string) | null>(null);
  gesture.current ??= createMarkGesture(prefix);
  return gesture.current;
}
