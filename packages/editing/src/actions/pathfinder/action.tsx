import type { IconRef } from '@weasel-js/icons';
import { applyBooleanOp, countOperands, previewBooleanOp, type BooleanOp, warnOutlines } from '@weasel-js/core';
import type { BooleanOpOptions, BooleanStrokes, NodeId } from '@weasel-js/core';
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { icon } from '../../icons.gen';

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
  union: icon('core:union'),
  intersect: icon('core:intersect'),
  subtract: icon('core:subtract'),
  exclude: icon('core:exclude'),
  divide: icon('core:divide'),
  crop: icon('core:crop'),
  trim: icon('core:trim'),
  merge: icon('core:merge'),
};

/** What a stroked operand gives the built-in Pathfinder actions, and a tool
 *  that should count strokes as they do. */
export const PATHFINDER_STROKES: BooleanStrokes = 'unfilled';

// ---------------------------------------------------------------------------
// Static descriptors
// ---------------------------------------------------------------------------

function opOptions(deps: ActionDeps): BooleanOpOptions {
  const scale = deps.view?.get().scale;
  return { strokes: PATHFINDER_STROKES, ...(scale ? { scale } : {}) };
}

function makePathfinderAction(op: BooleanOp): Action {
  return {
    id: ID_FOR[op],
    label: LABEL_FOR[op],
    icon: ICON_FOR[op],
    group: 'pathfinder',
    eligible: { capability: 'creates-shapes' },
    requires: ['operands', 'booleansAdapter', 'view', 'previewPaths', 'notices'],
    // No default keybindings — there's no industry-standard chord set for
    // boolean ops. Wire bindings explicitly via the actions registry override map.
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const adapter = deps.booleansAdapter;
        if (!adapter) return;
        const result = applyBooleanOp(adapter, op, opOptions(deps));
        if (result.kind === 'failed') warnOutlines(deps.notices, 'pathfinder', result.error);
      },
    } satisfies ImmediateInvoker,
    preview: (deps) => {
      const adapter = deps.booleansAdapter;
      const paths = deps.previewPaths;
      if (!adapter || !paths) return;
      const result = previewBooleanOp(adapter, op, opOptions(deps));
      if (result.kind !== 'pieces') return;
      return paths.show(result.pieces.map((piece) => {
        const paint = piece.paint ?? adapter.getPaint?.(piece.sourceId);
        return paint ? { path: piece.path, paint } : { path: piece.path };
      }));
    },
    enabled: (deps) => {
      const ids = deps?.operands?.get() ?? [];
      if (ids.length < 2) return ActionDisabledReason.SelectionRequired;
      const adapter = deps?.booleansAdapter;
      return adapter && countOperands(adapter, [...adapter.getSelection()] as NodeId[]) >= 2 ? true : ActionDisabledReason.NotApplicable;
    },
  };
}

/** Static descriptor for pathfinder-union. */
export const pathfinderUnionAction     = makePathfinderAction('union');
/** Static descriptor for pathfinder-subtract. */
export const pathfinderSubtractAction  = makePathfinderAction('subtract');
/** Static descriptor for pathfinder-intersect. */
export const pathfinderIntersectAction = makePathfinderAction('intersect');
/** Static descriptor for pathfinder-exclude. */
export const pathfinderExcludeAction   = makePathfinderAction('exclude');
/** Static descriptor for pathfinder-divide. */
export const pathfinderDivideAction    = makePathfinderAction('divide');
/** Static descriptor for pathfinder-crop. */
export const pathfinderCropAction      = makePathfinderAction('crop');
/** Static descriptor for pathfinder-trim. */
export const pathfinderTrimAction      = makePathfinderAction('trim');
/** Static descriptor for pathfinder-merge. */
export const pathfinderMergeAction     = makePathfinderAction('merge');

