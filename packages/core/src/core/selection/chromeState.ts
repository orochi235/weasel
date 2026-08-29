import type { NodeId } from '../scene/types';
import type { ModifierState } from '../modifierState';
import type { Bounds } from '../viewport/fitViewToBounds';
import { unionAABB } from 'core/geometry/unionBounds';

export type { Bounds };

/**
 * Read-only state that affordances consult on every render and hit-test
 * call. Built once per Canvas render via `buildChromeState`; affordances
 * must not cache it across calls.
 */
/** Nothing selected, nothing resolvable — what a caller reads before a
 *  surface has attached, or where chrome state has no owner. */
export const EMPTY_CHROME_STATE: ChromeState = {
  selection: [],
  multiActive: false,
  boundsOf: () => null,
  unionBounds: null,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false },
};

export interface ChromeState {
  /** Currently selected ids. Live; reflects useSelection's React state. */
  readonly selection: readonly NodeId[];
  /** True when the canvas is in multi-mode AND >= 2 ids are selected. */
  readonly multiActive: boolean;
  /** Bounds for any selection member id. Honors active-tool overlay state
   *  (move/resize/rotate ghosts → ghost bounds; otherwise → committed
   *  pose bounds). Returns null for unknown ids or ids whose bounds aren't
   *  computable. */
  boundsOf(id: string): Bounds | null;
  /** Multi-union AABB when `multiActive`. Computed lazily from `boundsOf`
   *  over every selected id, expanding rotated members to the extent of
   *  their ink; null otherwise. */
  readonly unionBounds: Bounds | null;
  /** Active modifier state at the moment of the call. */
  readonly modifiers: ModifierState;
  /** True iff the node's pose-descriptor declares it can carry a rotation.
   *  Affordances consult this to decide whether to expose rotate cursors /
   *  drag-bands. Defaults to `true` when the descriptor doesn't declare
   *  (back-compat) or when the id is unknown — the rotation gesture will
   *  no-op visually for poses without AABB fields, but the affordance
   *  doesn't lie about the cursor. Optional on the interface so unit-test
   *  call sites that construct `ChromeState` by hand keep compiling;
   *  affordances should treat an absent predicate as "true". */
  canRotate?(id: string): boolean;
}

export interface BuildChromeStateArgs {
  selection: readonly NodeId[];
  multiActive: boolean;
  effectiveBoundsOf: (id: string) => Bounds | null;
  modifiers: ModifierState;
  /** Optional rotation-support predicate. When omitted, `canRotate` returns
   *  `true` for every id — preserves pre-existing affordance behavior for
   *  unit-test call sites that don't wire pose-descriptor capability. */
  canRotate?: (id: string) => boolean;
}

export function buildChromeState(args: BuildChromeStateArgs): ChromeState {
  const { selection, multiActive, effectiveBoundsOf, modifiers, canRotate } = args;
  const cached: { value: Bounds | null; computed: boolean } = { value: null, computed: false };
  return {
    selection,
    multiActive,
    boundsOf: effectiveBoundsOf,
    modifiers,
    canRotate: canRotate ?? (() => true),
    get unionBounds() {
      if (cached.computed) return cached.value;
      cached.computed = true;
      if (!multiActive) {
        cached.value = null;
        return null;
      }
      cached.value = unionAABB(selection.map((id) => effectiveBoundsOf(id)));
      return cached.value;
    },
  };
}
