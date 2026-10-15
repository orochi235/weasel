import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Contribution } from '../contributions/types';
import { isTool } from './types';

export interface ToolLifecycleOptions {
  entriesById: ReadonlyMap<string, Contribution<unknown>>;
  /** The active tool's id, and the tools held on a hotkey, as the input scope reports them. */
  active: string | null;
  hotkeyStack: readonly string[];
  /** The active tool changed away from a tool. Not called when an empty slot is first filled. */
  onSwitch?: () => void;
}

/**
 * Runs each tool's `onActivate` / `onDeactivate` around the time it is live:
 * holding the active slot, or sitting in the hotkey stack.
 *
 * `onSwitch` runs between the outgoing tools' `onDeactivate` and the incoming
 * tools' `onActivate`, so whatever it ends is over before the new tool hears
 * it is live.
 */
export function useToolLifecycle(opts: ToolLifecycleOptions): void {
  const { active, hotkeyStack } = opts;
  const liveRef = useRef<ReadonlySet<string>>(new Set());
  const prevActiveRef = useRef(active);
  const entriesRef = useLatest(opts.entriesById);
  const onSwitchRef = useLatest(opts.onSwitch);

  const fire = useCallback((id: string, hook: 'onActivate' | 'onDeactivate'): void => {
    const tool = entriesRef.current.get(id);
    if (!tool || !isTool(tool)) return;
    const fn = tool[hook];
    if (!fn) return;
    try {
      fn();
    } catch (err) {
      console.error(`weasel: tool "${id}".${hook} threw`, err);
    }
  }, [entriesRef]);

  useEffect(() => {
    const prev = liveRef.current;
    const next = new Set<string>(active === null ? hotkeyStack : [active, ...hotkeyStack]);
    liveRef.current = next;
    for (const id of prev) if (!next.has(id)) fire(id, 'onDeactivate');
    // An empty slot being seeded has no outgoing tool, so nothing to end.
    if (prevActiveRef.current !== null && prevActiveRef.current !== active) onSwitchRef.current?.();
    prevActiveRef.current = active;
    for (const id of next) if (!prev.has(id)) fire(id, 'onActivate');
  });

  useEffect(() => () => {
    const live = liveRef.current;
    liveRef.current = new Set();
    for (const id of live) fire(id, 'onDeactivate');
  }, [fire]);
}
