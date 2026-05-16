import { applyBooleanOp, type BooleanOp, type BooleansAdapter } from '../booleans/booleans';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

const OPS: readonly BooleanOp[] = ['union', 'intersect', 'subtract', 'exclude', 'divide'];

const ID_FOR: Record<BooleanOp, string> = {
  union: 'pathfinder.union',
  intersect: 'pathfinder.intersect',
  subtract: 'pathfinder.subtract',
  exclude: 'pathfinder.exclude',
  divide: 'pathfinder.divide',
};

const LABEL_FOR: Record<BooleanOp, string> = {
  union: 'Unite',
  intersect: 'Intersect',
  subtract: 'Minus Front',
  exclude: 'Exclude',
  divide: 'Divide',
};

/** @experimental
 *
 * Five Pathfinder actions registered with stable ids and labels but no
 * default keybindings — there's no industry-standard chord set for
 * boolean ops. Wire bindings explicitly via the actions registry override
 * map, or surface via a `<ActionBar group="pathfinder">` / command
 * palette.
 *
 * Each action calls `applyBooleanOp(adapter, op)` directly; the adapter
 * decides whether the result is undoable (via `applyOps`) and how the
 * new node is minted. See `BooleansAdapter` JSDoc. */
export function defaultBooleanActions(adapter: BooleansAdapter): Action[] {
  return OPS.map((op): Action => ({
    id: ID_FOR[op],
    label: LABEL_FOR[op],
    group: 'pathfinder',
    run: () => {
      applyBooleanOp(adapter, op);
    },
    enabled: () => (adapter.getSelection().length >= 2 ? true : ActionDisabledReason.SelectionRequired),
  }));
}
