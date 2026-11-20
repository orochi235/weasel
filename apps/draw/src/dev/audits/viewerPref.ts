import { useState } from 'react';

/**
 * A view setting the viewer chose, kept in this browser between visits under `weasel.audits.<key>`: `[value, set,
 * keep]`, where `set` changes it for now and `keep` stores it, so a drag stores only where it ends. Storage that is
 * missing or refuses leaves the setting to last the visit.
 */
export function useViewerPref<T>(key: string, initial: T, read: (stored: string) => T | undefined): [T, (v: T) => void, (v: T) => void] {
  const storeKey = `weasel.audits.${key}`;
  const [value, set] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(storeKey);
      return (stored === null ? undefined : read(stored)) ?? initial;
    } catch {
      return initial;
    }
  });
  const keep = (v: T) => {
    try {
      localStorage.setItem(storeKey, String(v));
    } catch {
      // Nowhere to keep it.
    }
  };
  return [value, set, keep];
}

/** A stored size in pixels, when it is one. */
export const readSize = (s: string): number | undefined => (Number(s) > 0 ? Number(s) : undefined);
