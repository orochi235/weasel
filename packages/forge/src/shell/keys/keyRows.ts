import {
  type Action,
  type ActionsRegistry,
  actionBindings,
  type GestureSpec,
  keymapLeaderId,
  type KeymapDef,
  keymapShortcuts,
  keySpecShortcut,
} from '@weasel-js/core';
import type { useLabEntries } from '@weasel-js/labkit';
import { formatShortcut } from '@weasel-js/ui/components/ToolPalette';

/** What a binding's chip says: the keys for a keystroke, a word for any other gesture. */
export function describeBinding(spec: GestureSpec): string {
  const chip = keySpecShortcut(spec);
  if (chip) return spec.kind === 'key-held' ? `Hold ${formatShortcut(chip)}` : (formatShortcut(chip) ?? '');
  switch (spec.kind) {
    case 'wheel': return 'Wheel';
    case 'hover': return 'Hover';
    case 'drag': return 'Drag';
    case 'click': return 'Click';
    default: return spec.kind[0]!.toUpperCase() + spec.kind.slice(1);
  }
}

/** One registered action and every way to trigger it: `keys` are keystroke chips, `others` the rest. */
export interface KeyRow {
  id: string;
  label: string;
  group: string;
  keys: readonly string[];
  others: readonly string[];
}

/** The keymaps among the lab's installed entries, each with the leader that opens it. */
export function keymapDefs(entries: ReturnType<typeof useLabEntries>): KeymapDef[] {
  const defs: KeymapDef[] = [];
  for (const entry of entries.values()) {
    if (!entry.eligibility.keymap) continue;
    const open = entries.get(`${entry.id}.leader`)?.actions?.find((a) => a.id === keymapLeaderId(entry.id));
    const leader = open ? actionBindings(open).map((b) => b.spec) : [];
    if (leader.length === 0) continue;
    defs.push({ id: entry.id, label: entry.presentation?.label ?? entry.id, leader, bindings: entry.bindings ?? [] });
  }
  return defs;
}

/** A row per action that has a binding, sorted by group then label. A keymap's keys carry the path through
 *  their leader (`Loupe ▸ L`), so they never read as the plain key. */
export function keyRows(
  actions: readonly Action[],
  defs: readonly KeymapDef[],
  overrides?: ReturnType<ActionsRegistry['bindingOverrides']>,
): KeyRow[] {
  const inKeymap = new Map<string, string[]>();
  for (const def of defs) {
    for (const [id, chips] of keymapShortcuts(def, overrides)) {
      inKeymap.set(id, [...(inKeymap.get(id) ?? []), ...chips.flatMap((c) => formatShortcut(c) ?? [])]);
    }
  }
  const rows: KeyRow[] = [];
  for (const action of actions) {
    const keys = new Set<string>();
    const others = new Set<string>();
    for (const { spec } of actionBindings(action)) {
      (keySpecShortcut(spec) ? keys : others).add(describeBinding(spec));
    }
    for (const chip of inKeymap.get(action.id) ?? []) keys.add(chip);
    if (keys.size + others.size === 0) continue;
    rows.push({ id: action.id, label: action.label, group: action.group ?? 'other', keys: [...keys], others: [...others] });
  }
  return rows.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}
