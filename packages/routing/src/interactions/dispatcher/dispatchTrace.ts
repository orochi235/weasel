/**
 * What a canvas's dispatchers did: one record per resolved input and one per
 * mode switch, in a rolling buffer the devtools hook reads.
 */
import { createEmitter } from '@weasel-js/registry';
import type { DispatchRecord } from './dispatchRecord';
import { isDev } from '@weasel-js/react';

/** One entry per "mode change" — a kit state transition that isn't a
 *  dispatched input event but explains why an input was (or wasn't) handled
 *  later. Pushed via {@link DispatchTrace.recordModeSwitch}. */
export interface ModeSwitchLogEntry {
  kind: 'mode';
  ts: number;
  /** Logical mode name, e.g. `'editAnchors.editingId'`. */
  mode: string;
  from: string | null;
  to: string | null;
  /** Optional free-form context — `'enterPathEdit'`, `'exitPathEdit'`,
   *  `'selection-dropped target'`, etc. */
  detail?: string;
}

/** A trace entry: one {@link DispatchRecord} per resolved input, or a mode switch. */
export type TraceLogEntry = DispatchRecord | ModeSwitchLogEntry;

/** A rolling buffer that records in a dev build, and in any build while something watches it. */
export interface TraceRing<T> {
  /** Whether a push now keeps its entry. A caller building an entry checks first. */
  recording(): boolean;
  push(entry: T): void;
  /** The entries pushed after `cursor`, oldest first, and the cursor to pass
   *  next time. Start from 0. Entries the buffer has dropped are skipped. */
  since(cursor: number): { entries: T[]; cursor: number };
  /** Turn recording on until the returned release is called. */
  watch(): () => void;
  /** Hear each kept push. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** A {@link TraceRing} keeping the last `limit` entries. `dev` defaults to the build's. */
export function createTraceRing<T>(limit = 200, dev = isDev()): TraceRing<T> {
  const entries: T[] = [];
  const pushed = createEmitter();
  let total = 0;
  let watchers = 0;
  const recording = () => dev || watchers > 0;
  return {
    recording,
    push(entry) {
      if (!recording()) return;
      entries.push(entry);
      if (entries.length > limit) entries.shift();
      total++;
      pushed.emit();
    },
    since(cursor) {
      const first = total - entries.length;
      return { entries: entries.slice(Math.max(cursor, first) - first), cursor: total };
    },
    watch() {
      watchers++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        watchers--;
      };
    },
    subscribe: pushed.subscribe,
  };
}

/** One canvas's dispatch trace. `useGestureDispatcher` makes one, puts it on
 *  every `DispatcherContext` it builds, and publishes it as the `dispatchTrace` dep. */
export interface DispatchTrace extends TraceRing<TraceLogEntry> {
  recordModeSwitch(mode: string, from: string | null, to: string | null, detail?: string): void;
  /** Offer the record for what a press at the pointer would do, built only
   *  when {@link DispatchTrace.live} reads it. `null` withdraws it. */
  setLive(explain: (() => DispatchRecord) | null): void;
  live(): DispatchRecord | null;
}

/** A {@link DispatchTrace} keeping the last `limit` entries. `dev` defaults to the build's. */
export function createDispatchTrace(limit?: number, dev?: boolean): DispatchTrace {
  const ring = createTraceRing<TraceLogEntry>(limit, dev);
  let explain: (() => DispatchRecord) | null = null;
  return {
    ...ring,
    recordModeSwitch(mode, from, to, detail) {
      ring.push({ kind: 'mode', ts: Date.now(), mode, from, to, ...(detail !== undefined ? { detail } : {}) });
    },
    setLive(next) {
      explain = next;
    },
    live: () => explain?.() ?? null,
  };
}
