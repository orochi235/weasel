/**
 * Applies the `actions` prop overrides on top of whatever is registered, now
 * or later.
 *
 *   actions === null           → mute every action registered before it: the
 *                                defaults, not the tools' and presets' own
 *   actions[id] === null       → mute that id
 *   actions[id] = partial      → merge onto the existing descriptor (slot wins
 *                                over entry.id; warns once on mismatch)
 *   actions[id] = full (new)   → register alongside defaults
 *
 * `null` mutes rather than unregisters: the opt-out belongs to this canvas, so
 * a sibling sharing the registry keeps the action and this canvas's unmount
 * gives it back.
 */
import { useEffect } from 'react';
import type { ActionsProp } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { Action, ActionsRegistry } from '@weasel-js/routing';

/**
 * Re-applied whenever the registry changes under the overrides: an action
 * registered after them (a tool's, a contribution's, the viewport's after a
 * config change) would otherwise land over a merge or miss a partial entry
 * naming it.
 */
export function useActionsPropResolver(actions: ActionsProp | undefined): void {
  const reg = useActionsRegistry();
  const actionsRef = useLatest(actions);

  useEffect(() => {
    if (!reg) return;
    const prop = actionsRef.current;
    if (prop === undefined) return;
    let applied: Applied = { releases: [], live: new Map() };
    let applying = false;
    const warnedIds = new Set<string>();
    const apply = () => {
      applying = true;
      try {
        release(applied);
        applied = applyActionsProp(reg, prop, warnedIds);
      } finally {
        applying = false;
      }
    };
    apply();
    const off = reg.subscribe(() => {
      if (!applying && isStale(reg, prop, applied)) apply();
    });
    return () => { off(); release(applied); };
  }, [reg, actions, actionsRef]);
}

interface Applied {
  releases: Array<() => void>;
  /** The descriptor this resolver put live for each id it registered. */
  live: Map<string, Action>;
}

function release(applied: Applied): void {
  for (const u of applied.releases.splice(0).reverse()) u();
  applied.live.clear();
}

/** Whether the registry moved under the applied overrides: an id they
 *  register or merge is not live as they left it. */
function isStale(reg: ActionsRegistry, prop: ActionsProp, applied: Applied): boolean {
  // `null` opts out of the defaults registered before it, not the tools' and presets' own.
  if (prop === null) return false;
  const listed = reg.list();
  const byId = new Map(listed.map((a) => [a.id, a]));
  for (const [slotId, entry] of Object.entries(prop)) {
    if (entry === null) continue;
    const mine = applied.live.get(slotId);
    if (mine ? byId.get(slotId) !== mine : byId.has(slotId)) return true;
  }
  return false;
}

function applyActionsProp(reg: ActionsRegistry, prop: ActionsProp, warnedIds: Set<string>): Applied {
  const releases: Array<() => void> = [];
  const live = new Map<string, Action>();

  if (prop === null) {
    for (const id of reg.list().map((a) => a.id)) releases.push(reg.mute(id));
    return { releases, live };
  }

  for (const [slotId, entry] of Object.entries(prop)) {
    if (entry === null) {
      releases.push(reg.mute(slotId));
      continue;
    }

    const isFull = (e: Partial<Action>): e is Action =>
      typeof e.id === 'string' && typeof e.label === 'string' && !!e.invoker;
    const existing = reg.list().find((a) => a.id === slotId);

    if (!existing) {
      if (isFull(entry)) {
        releases.push(reg.register(entry));
        live.set(slotId, entry);
      } else if (!warnedIds.has(slotId)) {
        warnedIds.add(slotId);
        // Asked once this commit's effects have run, which may register it.
        queueMicrotask(() => {
          if (reg.list().some((a) => a.id === slotId)) return;
          console.warn(
            `weasel actions resolver: actions["${slotId}"] is a partial Action but no default ` +
            `with this id exists. Pass a complete {id, label, invoker} descriptor.`,
          );
        });
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
    releases.push(reg.register(merged));
    live.set(slotId, merged);
  }
  return { releases, live };
}
