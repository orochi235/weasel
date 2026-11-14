import { useLatest } from '@weasel-js/core';
import { after } from '@weasel-js/registry';
import { onLeave, type RecordCache } from '@weasel-js/storage';
import { useEffect, useRef } from 'react';
import { type SessionEntry, type SessionSlots, sessionSlots, writeSlots } from './sessionStore';

/** What one save writes: the document's entry, and any entries that depend on it, as `writeSession` takes them. */
export interface SessionWrite {
  primary: SessionEntry;
  dependents?: readonly SessionEntry[];
}

/** When `useAutosave` saves, where to, and what it reports after. */
export interface AutosaveOptions {
  /** How long after a change the save runs. Defaults to 300 ms. An infinite delay saves only on unmount or when
   *  the page goes away or turns hidden. */
  debounceMs?: number;
  /** When given, a save is scheduled on mount and then only when it changes. Without it, every
   *  render schedules one. */
  revision?: unknown;
  /** Called after every save attempt with whether the primary entry was written. */
  onSaved?: (ok: boolean) => void;
  /** Where the entries are kept, their keys the records' names. Defaults to `localStorage`, under the keys
   *  themselves. */
  records?: RecordCache;
}

/**
 * Keeps a document in storage: runs `write` a short delay after each change, and at once on unmount or when the page
 * goes away or turns hidden. `write` returning null skips that save. `onSaved` hears each save once its entries have
 * landed or failed.
 */
export function useAutosave(write: () => SessionWrite | null, opts: AutosaveOptions = {}): void {
  const writeRef = useLatest(write);
  const optsRef = useLatest(opts);
  const pendingRef = useRef<(() => void) | null>(null);
  const slotsRef = useRef<{ records: RecordCache | undefined; slots: SessionSlots } | null>(null);
  // The save on its way, null when none is.
  const busyRef = useRef<Promise<void> | null>(null);
  const idle = (): Promise<void> => busyRef.current ?? Promise.resolve();
  const tracksRevision = 'revision' in opts;

  useEffect(() => {
    const slotsFor = (records: RecordCache | undefined): SessionSlots => {
      const held = slotsRef.current;
      if (held && held.records === records) return held.slots;
      const slots = sessionSlots(records);
      slotsRef.current = { records, slots };
      if (held) void idle().then(() => held.slots.close());
      return slots;
    };
    const save = (): void => {
      // A save the page going away has already written must not be written again when its timer runs.
      if (pendingRef.current !== save) return;
      pendingRef.current = null;
      const { onSaved, records } = optsRef.current;
      let entries: SessionWrite | null;
      try {
        entries = writeRef.current();
      } catch {
        // A document that will not serialize.
        onSaved?.(false);
        return;
      }
      if (entries === null) return;
      const { slot } = slotsFor(records);
      const { primary, dependents } = entries;
      const start = (): Promise<void> =>
        writeSlots(slot, primary, dependents).then((ok) => onSaved?.(ok), () => onSaved?.(false));
      // One save at a time, so each hears whether its own entries landed. With none on its way, this one starts now:
      // a save on `pagehide` cannot wait.
      const run = busyRef.current ? busyRef.current.then(start) : start();
      busyRef.current = run;
      void run.finally(() => {
        if (busyRef.current === run) busyRef.current = null;
      });
    };
    pendingRef.current = save;
    return after(optsRef.current.debounceMs ?? 300, save);
    // With a revision, only its change reschedules; a render that leaves it alone must not clear the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, tracksRevision ? [opts.revision] : undefined);

  useEffect(() => {
    const flush = (): void => pendingRef.current?.();
    const stop = onLeave(flush);
    return () => {
      stop();
      flush();
      const held = slotsRef.current;
      slotsRef.current = null;
      if (held) void idle().then(() => held.slots.close());
    };
  }, []);
}
