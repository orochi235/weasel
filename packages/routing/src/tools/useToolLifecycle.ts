import { useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { Contribution } from '../contributions/types';
import { isTool, type Tool } from './types';

export interface ToolLifecycleOptions {
  entriesById: ReadonlyMap<string, Contribution<unknown>>;
  /** The active tool's id, and the tools held on a hotkey, as the input scope reports them. */
  active: string | null;
  hotkeyStack: readonly string[];
  /** The active tool changed away from a tool, or the tool holding the slot left `entriesById`.
   *  Not called when an empty slot is first filled. */
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
  const { active, hotkeyStack, entriesById } = opts;
  // Each live tool as last seen, so one that leaves the registry still hears it is no longer live.
  const liveRef = useRef<ReadonlyMap<string, Tool<unknown>>>(new Map());
  const prevActiveRef = useRef(active);
  const onSwitchRef = useLatest(opts.onSwitch);

  useEffect(() => {
    const prev = liveRef.current;
    const next = new Map<string, Tool<unknown>>();
    for (const id of active === null ? hotkeyStack : [active, ...hotkeyStack]) {
      const entry = entriesById.get(id);
      if (entry && isTool(entry)) next.set(id, entry);
    }
    liveRef.current = next;
    for (const [id, tool] of prev) if (!next.has(id)) fire(id, tool, 'onDeactivate');
    // An empty slot being seeded has no outgoing tool, so nothing to end. A
    // tool dropped from the registry while it held the slot is switched away from too.
    const switched = prevActiveRef.current !== null && prevActiveRef.current !== active;
    const dropped = active !== null && prev.has(active) && !next.has(active);
    if (switched || dropped) onSwitchRef.current?.();
    prevActiveRef.current = active;
    for (const [id, tool] of next) if (!prev.has(id)) fire(id, tool, 'onActivate');
  });

  useEffect(() => () => {
    const live = liveRef.current;
    liveRef.current = new Map();
    for (const [id, tool] of live) fire(id, tool, 'onDeactivate');
  }, []);
}

function fire(id: string, tool: Tool<unknown>, hook: 'onActivate' | 'onDeactivate'): void {
  const fn = tool[hook];
  if (!fn) return;
  try {
    fn();
  } catch (err) {
    console.error(`weasel: tool "${id}".${hook} threw`, err);
  }
}
