import { useRef } from 'react';
import { useLatest } from '@weasel-js/react';

/**
 * For a `'multiple'` selection whose values are written one at a time (each its own field, each its own action):
 * the values a reported list turns on or off, measured from what was last reported until the component renders
 * again, and from `on` after that. A sweep or an Alt-drag reports each step from its own copy, through the handler
 * it pressed with, so measuring from the render that handler closed over would rewrite or miss values.
 */
export function useValueChanges<V>(on: readonly V[]): (next: readonly V[]) => Map<V, boolean> {
  const shown = useLatest(on);
  const reported = useRef<{ over: readonly V[]; to: readonly V[] } | null>(null);
  return (next) => {
    const from = reported.current?.over === shown.current ? reported.current.to : shown.current;
    reported.current = { over: shown.current, to: next };
    const changes = new Map<V, boolean>();
    for (const v of next) if (!from.includes(v)) changes.set(v, true);
    for (const v of from) if (!next.includes(v)) changes.set(v, false);
    return changes;
  };
}
