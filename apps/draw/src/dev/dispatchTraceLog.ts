/**
 * Shared accessors + formatters for the dispatcher's dev trace log.
 *
 * The kit's gesture dispatcher (`src/interactions/dispatcher/dispatcher.ts`)
 * appends every input-handling decision to a rolling ring buffer mounted on
 * `window.__weaselDispatchLog__` — but only in DEV builds. Both dev surfaces
 * that visualize it (the floating `DispatchTracePanel` over the WeaselDraw
 * canvas, and the inline trace widget on the Toolkit Builder page) read it
 * through here so the entry types and formatting stay in one place.
 *
 * The entry types are structural copies of the dispatcher's own
 * `DispatchLogEntry` / `ModeSwitchLogEntry` — kept local so these dev panels
 * don't pull non-public symbols across the package boundary. If the kit ever
 * re-exports the types, swap these for the imports.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DispatchLogEntry {
  kind: 'dispatch';
  ts: number;
  eventKind: string;
  /** For key / key-held events, the key id (`'Escape'`, `' '`, …). */
  key?: string;
  candidates: Array<{
    actionId: string;
    scope: 'hotkey' | 'active' | 'ambient';
    enabledResult: boolean | string;
  }>;
  fired: string | null;
  outcome: 'handled' | 'unhandled';
}

export interface ModeSwitchLogEntry {
  kind: 'mode';
  ts: number;
  mode: string;
  from: string | null;
  to: string | null;
  detail?: string;
}

export type TraceLogEntry = DispatchLogEntry | ModeSwitchLogEntry;

interface DispatchLogWindow extends Window {
  __weaselDispatchLog__?: TraceLogEntry[];
}

/** Snapshot the current log (empty array when absent — i.e. prod builds). */
export function readLog(): TraceLogEntry[] {
  if (typeof window === 'undefined') return [];
  const w = window as DispatchLogWindow;
  return w.__weaselDispatchLog__ ?? [];
}

/** Empty the log in place so the dispatcher's own reference keeps appending
 *  into the same array (replacing the global would orphan the writer). */
export function clearLog(): void {
  if (typeof window === 'undefined') return;
  const w = window as DispatchLogWindow;
  const log = w.__weaselDispatchLog__;
  if (log) log.length = 0;
}

export function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  return `${m}m${Math.floor(sec % 60)}s`;
}

export function formatEnabled(v: boolean | string): string {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return v;
}

const POLL_MS = 250;

export interface DispatchTraceLog {
  entries: readonly TraceLogEntry[];
  /** Wall clock at the last poll, for computing each entry's age. */
  now: number;
  clear: () => void;
}

/** Polls the log every 250 ms while `enabled`. `entries` only changes when
 *  the log did; `now` advances every tick so ages count up while idle. */
export function useDispatchTraceLog(enabled = true): DispatchTraceLog {
  const [entries, setEntries] = useState<TraceLogEntry[]>(() => readLog().slice());
  const [now, setNow] = useState<number>(() => Date.now());
  const lastLenRef = useRef<number>(entries.length);
  const lastTsRef = useRef<number>(entries.length ? entries[entries.length - 1]!.ts : 0);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      const log = readLog();
      const len = log.length;
      const lastTs = len ? log[len - 1]!.ts : 0;
      if (len !== lastLenRef.current || lastTs !== lastTsRef.current) {
        lastLenRef.current = len;
        lastTsRef.current = lastTs;
        setEntries(log.slice());
      }
      setNow(Date.now());
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);

  const clear = useCallback(() => {
    clearLog();
    setEntries([]);
    lastLenRef.current = 0;
    lastTsRef.current = 0;
  }, []);

  return { entries, now, clear };
}
