/**
 * Shared accessors + formatters for a canvas's dispatch trace.
 *
 * Both dev surfaces that visualize it (the floating `DispatchTracePanel` over
 * the WeaselDraw canvas, and the inline trace widget on the Toolkit Builder
 * page) read it through here, as a devtools panel connected to the page's
 * `window.__weaselDevtools__` over the in-page transport.
 */

import { useCallback, useEffect, useState } from 'react';
import type { DispatchRecord, TraceLogEntry } from '@weasel-js/core/routing';
import {
  DEVTOOLS_PROTOCOL, createInPageTransports, installDevtoolsHook, type DevtoolsTraceSlice, type PageMessage,
} from '@weasel-js/core/devtools';

export type { DispatchRecord, TraceLogEntry };

export function formatAge(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  return `${m}m${Math.floor(sec % 60)}s`;
}

const POLL_MS = 250;
const KEEP = 200;

export interface DispatchTraceLog {
  entries: readonly TraceLogEntry[];
  /** A press at the pointer, re-predicted every poll. */
  live: DispatchRecord | null;
  /** Wall clock at the last poll, for computing each entry's age. */
  now: number;
  clear: () => void;
}

/** Follows the trace of the newest canvas on the page, polling every 250 ms while `enabled`.
 *  `entries` only changes when the trace did; `now` advances every tick so ages count up while idle. */
export function useDispatchTraceLog(enabled = true): DispatchTraceLog {
  const [entries, setEntries] = useState<TraceLogEntry[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [live, setLive] = useState<DispatchRecord | null>(null);

  useEffect(() => {
    const hook = installDevtoolsHook();
    if (!enabled || !hook) return;
    const { page, panel } = createInPageTransports();
    let rootId: string | null = null;
    let cursor = 0;
    let requestId = 0;
    const off = panel.onMessage((m: PageMessage) => {
      if (m.type === 'sup') rootId = m.roots.at(-1)?.id ?? null;
      else if (m.type === 'root-added') rootId = m.root.id;
      else if (m.type === 'root-removed' && m.rootId === rootId) rootId = hook.roots().at(-1)?.id ?? null;
      else if (m.type === 'result') {
        const slice = m.result as DevtoolsTraceSlice;
        cursor = slice.cursor;
        if (slice.entries.length) {
          const fresh = slice.entries as unknown as TraceLogEntry[];
          setEntries((prev) => [...prev, ...fresh].slice(-KEEP));
        }
        setLive(slice.live as unknown as DispatchRecord | null);
      }
    });
    const close = hook.connect(page);
    panel.send({ type: 'yo', protocol: DEVTOOLS_PROTOCOL });
    const id = window.setInterval(() => {
      if (rootId) panel.send({ type: 'get-trace', protocol: DEVTOOLS_PROTOCOL, requestId: ++requestId, rootId, cursor });
      setNow(Date.now());
    }, POLL_MS);
    return () => {
      window.clearInterval(id);
      panel.send({ type: 'bye', protocol: DEVTOOLS_PROTOCOL });
      close();
      off();
    };
  }, [enabled]);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, live, now, clear };
}
