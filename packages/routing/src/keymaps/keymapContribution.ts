/**
 * A keymap and the leader that opens it, from one definition. The keymap is an
 * entry whose bindings are live only while it is open; the leader is an
 * action on the hotkey tier, so it outranks what the active tool binds to the
 * same key, and it opens the keymap mid-gesture as well as between them.
 */
import type { GestureSpec } from '@weasel-js/gestures';
import { ActionDisabledReason, type Action } from '../interactions/actions/action';
import type { BoundGesture, GestureBinding } from '../interactions/actions/binding';
import type { Contribution, OverlayPosition } from '../contributions/types';
import { KEYMAP_HOLD, type KeymapUnbound } from './keymapStack';

/** What {@link keymapContribution} builds a keymap and its leader from. */
export interface KeymapDef<TOverlay = never> {
  /** The keymap entry's id. Its leader action is `keymap.<id>`. */
  id: string;
  /** What the hint and a shortcut chip call it: `Loupe ▸ 2`. */
  label: string;
  /** The keystroke, or keystrokes, that open it. A `key-held` spec is read as
   *  its `key` form: holding the key is what holds the keymap open. */
  leader: GestureSpec | readonly GestureSpec[];
  /** The keymap's own bindings. Escape is not one: it cancels a gesture in flight, or else closes the keymap. */
  bindings: readonly GestureBinding[];
  /** Actions the bindings name that are not registered elsewhere. */
  actions?: readonly Action[];
  /** Overrides the `gestures.keymapUnbound` kit setting for this keymap. */
  unbound?: KeymapUnbound;
  /** Drawn while the keymap is open. */
  overlay?: TOverlay | TOverlay[];
  overlayPosition?: OverlayPosition;
}

/** The leader action's id for keymap `id`. */
export const keymapLeaderId = (id: string): string => `keymap.${id}`;

/** The binding id of a keymap's leader — what a binding override rebinds it by.
 *  A second leader key is `<id>#1`, and so on. */
export const keymapLeaderBindingId = (id: string, index = 0): string =>
  index === 0 ? `${keymapLeaderId(id)}.leader` : `${keymapLeaderId(id)}.leader#${index}`;

/** The leader keystrokes of `def` as its leader action binds them, each with its binding id. */
export function leaderBindings(def: Pick<KeymapDef, 'id' | 'leader'>): BoundGesture[] {
  return [def.leader].flat().map((spec, i) => ({
    spec: spec.kind === 'key-held' ? { ...spec, kind: 'key' } : spec,
    opts: { id: keymapLeaderBindingId(def.id, i) },
  }));
}

const isPlainEscape = (spec: GestureSpec): boolean =>
  spec.kind === 'key' && [spec.key].flat().includes('Escape') && Object.values(spec.mods ?? {}).every((m) => m !== true);

/** `[keymap entry, leader entry]`. Triggered without a key, the leader opens
 *  its keymap tapped; `trigger('keymap.<id>', { hold: true })` holds it open
 *  until Escape. Install both, with `<SceneCanvas ambient>`
 *  or `useTools`'s `ambient`; the leader entry carries the actions. */
export function keymapContribution<TOverlay = never>(def: KeymapDef<TOverlay>): Contribution<TOverlay>[] {
  if (def.bindings.some((b) => isPlainEscape(b.spec))) {
    throw new Error(`keymap "${def.id}" binds Escape, which always closes a keymap`);
  }
  const open: Action = {
    id: keymapLeaderId(def.id),
    label: `Open ${def.label} keys`,
    scope: 'hotkey',
    defaultBinding: leaderBindings(def),
    requires: ['keymaps'],
    enabled: (deps) => (deps?.keymaps ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        deps.keymaps?.push(def.id, def.label, { bindings: def.bindings, ...(params?.hold === true ? { heldBy: KEYMAP_HOLD } : {}) });
      },
    },
  };
  return [
    {
      id: def.id,
      eligibility: { keymap: def.unbound ? { unbound: def.unbound } : true },
      bindings: [...def.bindings],
      presentation: { label: def.label },
      ...(def.overlay !== undefined ? { overlay: def.overlay } : {}),
      ...(def.overlayPosition ? { overlayPosition: def.overlayPosition } : {}),
    },
    {
      id: `${def.id}.leader`,
      eligibility: { always: true },
      actions: [open, ...(def.actions ?? [])],
    },
  ];
}
