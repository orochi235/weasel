import { useLatest } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import { type SessionEntry, writeSession } from './sessionStore';

/** What one save writes: the document's entry, and any entries that depend on it, as `writeSession` takes them. */
export interface SessionWrite {
  primary: SessionEntry;
  dependents?: readonly SessionEntry[];
}

/** When `useAutosave` saves, and what it reports after. */
export interface AutosaveOptions {
  /** How long after a change the save runs. Defaults to 300 ms. */
  delayMs?: number;
  /** When given, a save is scheduled on mount and then only when it changes. Without it, every
   *  render schedules one. */
  revision?: unknown;
  /** Called after every save attempt with whether the primary entry was written. */
  onSaved?: (ok: boolean) => void;
}

/**
 * Keeps a document in local storage: runs `write` a short delay after each change, and at once on
 * unmount or when the page goes away. `write` returning null skips that save.
 */
export function useAutosave(write: () => SessionWrite | null, opts: AutosaveOptions = {}): void {
  const writeRef = useLatest(write);
  const optsRef = useLatest(opts);
  const pendingRef = useRef<(() => void) | null>(null);
  const tracksRevision = 'revision' in opts;

  useEffect(() => {
    const save = (): void => {
      pendingRef.current = null;
      const { onSaved } = optsRef.current;
      try {
        const entries = writeRef.current();
        if (entries === null) return;
        const ok = writeSession(localStorage, entries.primary, entries.dependents);
        onSaved?.(ok);
      } catch {
        // No store at all, or a document that will not serialize.
        onSaved?.(false);
      }
    };
    pendingRef.current = save;
    const id = setTimeout(save, optsRef.current.delayMs ?? 300);
    return () => clearTimeout(id);
    // With a revision, only its change reschedules; a render that leaves it alone must not clear the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, tracksRevision ? [opts.revision] : undefined);

  useEffect(() => {
    const flush = (): void => pendingRef.current?.();
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}
