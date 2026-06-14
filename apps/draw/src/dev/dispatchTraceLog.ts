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
