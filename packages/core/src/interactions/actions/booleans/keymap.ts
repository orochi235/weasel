import type { KeyHeldSpec, KeySpec } from '@weasel-js/gestures';
import { holdPreview, holdPreviewId, keymapContribution, type Action, type Contribution } from '@weasel-js/routing';
import {
  pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction,
  pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction,
} from './action';

/** The Pathfinder keymap's id; its leader action is `keymap.pathfinder`. */
export const PATHFINDER_KEYMAP_ID = 'pathfinder';

/** Alt+P, by the physical key too, since with Alt held on a Mac it types `π`. */
export const PATHFINDER_LEADER: KeySpec = { kind: 'key', key: 'p', code: 'KeyP', mods: { alt: true } };

// Alt is optional so the keys work with the leader held down as well as tapped.
const heldKey = (letter: string): KeyHeldSpec =>
  ({ kind: 'key-held', key: letter, code: `Key${letter.toUpperCase()}`, mods: { alt: 'optional' } });

const KEYS: readonly (readonly [Action, string])[] = [
  [pathfinderUnionAction, 'u'],
  [pathfinderIntersectAction, 'i'],
  [pathfinderSubtractAction, 'm'],
  [pathfinderExcludeAction, 'x'],
  [pathfinderDivideAction, 'd'],
  [pathfinderCropAction, 'c'],
  [pathfinderTrimAction, 't'],
  [pathfinderMergeAction, 'r'],
];

/**
 * The Pathfinder operations on held keys, behind the leader Alt+P: holding
 * an operation's key previews it on the selection, releasing runs it, and
 * Escape while it is held cancels it. Each binding's id is its hold's action
 * id (`pathfinder.union.hold`), which is what a host rebinds it by. The
 * operations themselves come from the `paths` preset; this carries only their
 * holds. Install it with `<SceneCanvas ambient>`.
 */
export const PATHFINDER_KEYMAP: readonly Contribution<never>[] = keymapContribution({
  id: PATHFINDER_KEYMAP_ID,
  label: 'Pathfinder',
  leader: PATHFINDER_LEADER,
  bindings: KEYS.map(([action, letter]) => ({
    spec: heldKey(letter),
    actionId: holdPreviewId(action.id),
    opts: { id: holdPreviewId(action.id) },
  })),
  actions: KEYS.map(([action]) => holdPreview(action)),
});
