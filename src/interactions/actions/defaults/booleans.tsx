import type { ReactNode } from 'react';
import { applyBooleanOp, type BooleanOp, type BooleansAdapter } from '../booleans/booleans';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { SelectionApi } from 'core/selection/useSelection';
import {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
  CropIcon,
} from './icons/booleanIcons';

const ID_FOR: Record<BooleanOp, string> = {
  union: 'pathfinder.union',
  intersect: 'pathfinder.intersect',
  subtract: 'pathfinder.subtract',
  exclude: 'pathfinder.exclude',
  divide: 'pathfinder.divide',
  crop: 'pathfinder.crop',
};

const LABEL_FOR: Record<BooleanOp, string> = {
  union: 'Unite',
  intersect: 'Intersect',
  subtract: 'Minus Front',
  exclude: 'Exclude',
  divide: 'Divide',
  crop: 'Crop',
};

const ICON_FOR: Record<BooleanOp, ReactNode> = {
  union: <UnionIcon />,
  intersect: <IntersectIcon />,
  subtract: <SubtractIcon />,
  exclude: <ExcludeIcon />,
  divide: <DivideIcon />,
  crop: <CropIcon />,
};

// ---------------------------------------------------------------------------
// Static descriptors (Phase 4+)
// ---------------------------------------------------------------------------

function makePathfinderAction(op: BooleanOp): Action {
  return {
    id: ID_FOR[op],
    label: LABEL_FOR[op],
    icon: ICON_FOR[op],
    group: 'pathfinder',
    // No default keybindings — there's no industry-standard chord set for
    // boolean ops. Wire bindings explicitly via the actions registry override map.
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const adapter = deps.booleansAdapter as BooleansAdapter | undefined;
        if (!adapter) return;
        applyBooleanOp(adapter, op);
      },
    } satisfies ImmediateInvoker,
    enabled: (deps) => {
      const selection = deps?.selection as SelectionApi | undefined;
      const count = selection?.get().length ?? 0;
      return count >= 2 ? true : ActionDisabledReason.SelectionRequired;
    },
  };
}

/** @experimental Static descriptor for pathfinder-union (Phase 4+). */
export const pathfinderUnionAction     = makePathfinderAction('union');
/** @experimental Static descriptor for pathfinder-subtract (Phase 4+). */
export const pathfinderSubtractAction  = makePathfinderAction('subtract');
/** @experimental Static descriptor for pathfinder-intersect (Phase 4+). */
export const pathfinderIntersectAction = makePathfinderAction('intersect');
/** @experimental Static descriptor for pathfinder-exclude (Phase 4+). */
export const pathfinderExcludeAction   = makePathfinderAction('exclude');
/** @experimental Static descriptor for pathfinder-divide (Phase 4+). */
export const pathfinderDivideAction    = makePathfinderAction('divide');
/** @experimental Static descriptor for pathfinder-crop (Phase 4+). */
export const pathfinderCropAction      = makePathfinderAction('crop');

