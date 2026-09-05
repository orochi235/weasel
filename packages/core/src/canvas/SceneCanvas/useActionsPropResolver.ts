/**
 * `useActionsPropResolver` — applies the `actions` prop overrides on top of
 * whatever `useStandardActions` registered. Runs after it (caller mounts this
 * hook last). Resolution rules:
 *
 *   actions === null           → unregister every currently-registered action
 *   actions[id] === null       → unregister that id
 *   actions[id] = partial      → merge onto the existing descriptor (slot wins
 *                                over entry.id; warns once on mismatch)
 *   actions[id] = full (new)   → register alongside defaults
 */
import { useEffect, useRef } from 'react';
import {
  useActionsRegistry,
  type Action,
  type ActionsProp,
} from 'interactions/actions/registry';

export function useActionsPropResolver(actions: ActionsProp | undefined): void {
  const reg = useActionsRegistry();
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!reg) return;
    const prop = actionsRef.current;

    if (prop === null) {
      const ids = reg.list().map((a) => a.id);
      for (const id of ids) reg.unregister(id);
      return;
    }

    if (!prop) return;

    const unregisters: Array<() => void> = [];
    const warnedIds = new Set<string>();

    for (const [slotId, entry] of Object.entries(prop)) {
      if (entry === null) {
        reg.unregister(slotId);
        continue;
      }

      const isFull = (e: Partial<Action>): e is Action =>
        typeof e.id === 'string' && typeof e.label === 'string' && !!e.invoker;
      const existing = reg.list().find((a) => a.id === slotId);

      if (!existing) {
        if (isFull(entry)) {
          unregisters.push(reg.register(entry));
        } else if (!warnedIds.has(slotId)) {
          warnedIds.add(slotId);
          console.warn(
            `weasel actions resolver: actions["${slotId}"] is a partial Action but no default ` +
            `with this id exists. Pass a complete {id, label, invoker} descriptor.`,
          );
        }
        continue;
      }

      if (entry.id !== undefined && entry.id !== slotId && !warnedIds.has(`mismatch:${slotId}`)) {
        warnedIds.add(`mismatch:${slotId}`);
        console.warn(
          `weasel actions resolver: actions["${slotId}"].id="${entry.id as string}" mismatches the slot key. ` +
          `Ignoring the id field; the action remains at id="${slotId}".`,
        );
      }
      const { id: _drop, ...rest } = entry;
      void _drop;
      const merged: Action = { ...existing, ...rest };
      // No explicit restore: `register` stacks, so popping `merged` uncovers
      // the descriptor it displaced. Re-registering `existing` here would push
      // a stale snapshot back on top and never take it off again.
      unregisters.push(reg.register(merged));
    }

    return () => { for (const u of unregisters) u(); };
  }, [reg, actions]);
}
