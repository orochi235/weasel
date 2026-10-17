import type { IconRef } from '@weasel-js/icons';
import { applyBooleanOp, type BooleanOp } from './booleans';
import type { BooleanStrokes } from './operands';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { icon } from '../../../icons.gen';

const ID_FOR: Record<BooleanOp, string> = {
  union: 'pathfinder.union',
  intersect: 'pathfinder.intersect',
  subtract: 'pathfinder.subtract',
  exclude: 'pathfinder.exclude',
  divide: 'pathfinder.divide',
  crop: 'pathfinder.crop',
  trim: 'pathfinder.trim',
  merge: 'pathfinder.merge',
};

const LABEL_FOR: Record<BooleanOp, string> = {
  union: 'Unite',
  intersect: 'Intersect',
  subtract: 'Minus Front',
  exclude: 'Exclude',
  divide: 'Divide',
  crop: 'Crop',
  trim: 'Trim',
  merge: 'Merge',
};

const ICON_FOR: Record<BooleanOp, IconRef> = {
  union: icon('union'),
  intersect: icon('intersect'),
  subtract: icon('subtract'),
  exclude: icon('exclude'),
  divide: icon('divide'),
  crop: icon('crop'),
  trim: icon('trim'),
  merge: icon('merge'),
};

/** What a stroked operand gives the built-in Pathfinder actions and the shape builder. */
export const PATHFINDER_STROKES: BooleanStrokes = 'unfilled';

// ---------------------------------------------------------------------------
// Static descriptors
// ---------------------------------------------------------------------------

function makePathfinderAction(op: BooleanOp): Action {
  return {
    id: ID_FOR[op],
    label: LABEL_FOR[op],
    icon: ICON_FOR[op],
    group: 'pathfinder',
    eligible: { capability: 'creates-shapes' },
    requires: ['selection', 'booleansAdapter', 'view'],
    // No default keybindings — there's no industry-standard chord set for
    // boolean ops. Wire bindings explicitly via the actions registry override map.
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const adapter = deps.booleansAdapter;
        if (!adapter) return;
        const scale = deps.view?.get().scale;
        const result = applyBooleanOp(adapter, op, { strokes: PATHFINDER_STROKES, ...(scale ? { scale } : {}) });
        if (result.kind === 'failed') console.warn(`[pathfinder] ${result.error.message}`);
      },
    } satisfies ImmediateInvoker,
    enabled: (deps) => {
      const selection = deps?.selection;
      const count = selection?.get().length ?? 0;
      return count >= 2 ? true : ActionDisabledReason.SelectionRequired;
    },
  };
}

/** @experimental Static descriptor for pathfinder-union. */
export const pathfinderUnionAction     = makePathfinderAction('union');
/** @experimental Static descriptor for pathfinder-subtract. */
export const pathfinderSubtractAction  = makePathfinderAction('subtract');
/** @experimental Static descriptor for pathfinder-intersect. */
export const pathfinderIntersectAction = makePathfinderAction('intersect');
/** @experimental Static descriptor for pathfinder-exclude. */
export const pathfinderExcludeAction   = makePathfinderAction('exclude');
/** @experimental Static descriptor for pathfinder-divide. */
export const pathfinderDivideAction    = makePathfinderAction('divide');
/** @experimental Static descriptor for pathfinder-crop. */
export const pathfinderCropAction      = makePathfinderAction('crop');
/** @experimental Static descriptor for pathfinder-trim. */
export const pathfinderTrimAction      = makePathfinderAction('trim');
/** @experimental Static descriptor for pathfinder-merge. */
export const pathfinderMergeAction     = makePathfinderAction('merge');

