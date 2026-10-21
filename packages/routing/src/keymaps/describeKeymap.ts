/**
 * What a hint, a menu or a binding list shows for a keymap: its rows, Escape
 * first, and each key's path through the leaders that reach it.
 */
import { formatShortcut, type GestureSpec } from '@weasel-js/gestures';
import type { MenuShortcut } from '@weasel-js/menu';
import type { Action } from '../interactions/actions/action';
import { actionBindings, type GestureBinding } from '../interactions/actions/binding';
import { keySpecShortcut, paramsMatch } from '../interactions/actions/actionShortcuts';
import { resolveParams } from '../interactions/actions/invoker';
import { NO_OVERRIDES, overriddenBindings, type ResolvedBindingOverrides } from '../interactions/actions/bindingOverrides';
import { keymapLeaderId, leaderBindings, type KeymapDef } from './keymapContribution';
import type { OpenKeymap } from './keymapStack';

/** One row of a keymap's hint: a key chip, or a pointer gesture in words, and what it does. */
export interface KeymapRow {
  shortcut?: MenuShortcut;
  gesture?: string;
  label: string;
}

/** An open keymap as a hint shows it: {@link describeKeymap}'s result. */
export interface KeymapDescription {
  id: string;
  label: string;
  /** Whether a held leader is keeping it open. */
  held: boolean;
  rows: readonly KeymapRow[];
}

const ESCAPE: KeymapRow = { shortcut: { key: 'Escape', mod: false, alt: false, shift: false }, label: 'Close' };

const GESTURE_WORDS: Partial<Record<GestureSpec['kind'], string>> = {
  click: 'click', doubleClick: 'double-click', drag: 'drag', longPress: 'long-press',
  contextMenu: 'right-click', wheel: 'scroll', pinch: 'pinch', pointerDown: 'press',
};

const MOD_WORDS: readonly [keyof NonNullable<GestureSpec['mods']>, string][] = [
  ['mod', 'Mod'], ['ctrl', 'Ctrl'], ['meta', 'Meta'], ['alt', 'Alt'], ['shift', 'Shift'],
];

/** A pointer gesture in words, modifiers first: `Shift-click`. */
function gestureWords(spec: GestureSpec): string | undefined {
  if (spec.kind === 'key-held') {
    const chip = keySpecShortcut(spec);
    return chip ? `Hold ${formatShortcut(chip)}` : undefined;
  }
  const word = GESTURE_WORDS[spec.kind];
  if (!word) return undefined;
  const mods = MOD_WORDS.filter(([m]) => spec.mods?.[m] === true).map(([, w]) => w);
  const text = [...mods, word].join('-');
  return text[0]!.toUpperCase() + text.slice(1);
}

/** The rows a hint lists for an open keymap, under the overrides in force. */
export function describeKeymap(
  level: OpenKeymap,
  actions: readonly Action[],
  overrides: ResolvedBindingOverrides = NO_OVERRIDES,
): KeymapDescription {
  const byId = new Map(actions.map((a) => [a.id, a]));
  // A binding that picks a variant by its params is listed by the variant's label: Flip Horizontal.
  const labelOf = (b: GestureBinding): string => {
    const action = byId.get(b.actionId);
    const params = resolveParams(b.opts?.params);
    const variant = params && action?.variants?.find((v) => paramsMatch(params, v.params));
    return variant ? variant.label : action?.label ?? b.actionId;
  };
  const rows: KeymapRow[] = [ESCAPE];
  for (const b of overriddenBindings(level.bindings, level.id, overrides)) {
    const label = labelOf(b);
    const shortcut = b.spec.kind === 'key' ? keySpecShortcut(b.spec) : undefined;
    if (shortcut) rows.push({ shortcut, label });
    else {
      const gesture = gestureWords(b.spec);
      if (gesture) rows.push({ gesture, label });
    }
  }
  return { id: level.id, label: level.label, held: level.heldBy !== undefined, rows };
}

/**
 * Every key in `def` as a menu chip, by action id, each carrying the path
 * through its leader (`Loupe ▸ 2`), under `overrides`. A keymap with no key
 * leader gives its keys no path.
 */
export function keymapShortcuts(
  def: KeymapDef,
  overrides: ResolvedBindingOverrides = NO_OVERRIDES,
): ReadonlyMap<string, readonly MenuShortcut[]> {
  const leaderChip = overriddenBindings(actionBindings({ id: keymapLeaderId(def.id), defaultBinding: leaderBindings(def) }), null, overrides)
    .map((b) => keySpecShortcut(b.spec))
    .find((c) => c !== undefined);
  const out = new Map<string, MenuShortcut[]>();
  for (const b of overriddenBindings(def.bindings, def.id, overrides)) {
    if (b.spec.kind !== 'key') continue;
    const chip = keySpecShortcut(b.spec);
    if (!chip) continue;
    const withPath: MenuShortcut = leaderChip ? { ...chip, leader: [{ label: def.label, shortcut: leaderChip }] } : chip;
    out.set(b.actionId, [...(out.get(b.actionId) ?? []), withPath]);
  }
  return out;
}
