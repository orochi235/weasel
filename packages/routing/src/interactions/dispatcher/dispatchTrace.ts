/**
 * Dev-only trace of what the dispatcher did: one record per resolved input and
 * one per mode switch, in a rolling buffer the dev tools read.
 */
import type { DispatchRecord } from './dispatchRecord';

/** True in dev builds; false in production. Tree-shakes the Proxy + trace
 *  log out of prod entirely. */
export const DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();

/** One entry per "mode change" — a kit state transition that isn't a
 *  dispatched input event but is load-bearing for understanding why an
 *  input was (or wasn't) handled later. Pushed via `recordModeSwitch()`;
 *  consumers include the editAnchors dep (editingId changes), and
 *  could expand to active-tool / hotkey-stack / focus changes. */
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

const TRACE_LIMIT = 200;

// `traceLog` is the rolling buffer; in dev it IS `window.__weaselDispatchLog__`
// so the ToolkitBuilder widget can poll it. Bind to the existing global if one
// is already present rather than reassigning a fresh array: an HMR
// re-evaluation of this module would otherwise create a new array and orphan
// the long-lived Dispatcher (held in a SceneCanvas `useRef` that survives Fast
// Refresh) whose `recordTrace` closure still pushes to the previous array — the
// widget would then read an array nothing writes to. Reuse keeps every module
// instance and the widget pointed at one shared array.
//
// `__weaselDispatchLog__` is the historical global; entries are a union of
// dispatch + mode-switch records. Filter via `(e) => e.kind === 'dispatch'` if
// you only want input routing.
const traceLog: TraceLogEntry[] =
  DEV && typeof window !== 'undefined'
    ? ((window as unknown as { __weaselDispatchLog__?: TraceLogEntry[] }).__weaselDispatchLog__ ??=
        [])
    : [];

export function recordTrace(entry: TraceLogEntry): void {
  if (!DEV) return;
  traceLog.push(entry);
  if (traceLog.length > TRACE_LIMIT) traceLog.shift();
}

/**
 * Dev only: offer the record for what a press at the pointer would do, as a
 * thunk on `window.__weaselDispatchLive__`. The hover pump offers one per move
 * and a reader builds the record only when it looks, so no record is built
 * while nothing is watching. `null` withdraws it when the pointer leaves.
 *
 * @internal
 */
export function publishLiveDispatch(explain: (() => DispatchRecord) | null): void {
  if (!DEV || typeof window === 'undefined') return;
  (window as unknown as { __weaselDispatchLive__?: (() => DispatchRecord) | null })
    .__weaselDispatchLive__ = explain;
}

/** Push a mode-switch record into the trace log. Safe to call from
 *  anywhere; no-ops outside DEV. */
export function recordModeSwitch(
  mode: string,
  from: string | null,
  to: string | null,
  detail?: string,
): void {
  recordTrace({
    kind: 'mode',
    ts: Date.now(),
    mode,
    from,
    to,
    ...(detail !== undefined ? { detail } : {}),
  });
}
