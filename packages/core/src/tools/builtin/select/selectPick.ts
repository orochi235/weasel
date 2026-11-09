import type { Action, ImmediateParams, SelectionApi, WorldPoint } from '@weasel-js/routing';
import type { SelectModifiers } from '@weasel-js/select';
import type { NodeId } from 'core/scene/types';
import { extendPressLocked, extendsSelection } from 'core/selection/extendPressLocked';
import { pressTarget, type PressTargetTree } from '../pressTarget';
import { pressDecision, type PressTree } from './pressDecision';

type Between = (from: NodeId, to: NodeId) => readonly NodeId[];

export interface SelectPickOptions {
  /** The node under the point, before any group above it is considered. */
  pickHit: (world: WorldPoint, alt: boolean, selection: readonly string[]) => string | null;
  /** True when an extend press must leave the selection alone. */
  extendLocked: () => boolean;
  /** The tree the press reads. */
  tree: () => PressTree & PressTargetTree;
  /** What a range covers for a press inside `level`, or undefined to walk the selection's order. */
  rangeIn: (level: string | null) => Between | undefined;
  /** Told the id the press held its click back for, or null. */
  pressed: (deferred: string | null) => void;
}

/**
 * `select.pick` — classifies the press and updates the node selection.
 *
 * Bound to `pointerDown` rather than `click` on purpose: pressing an
 * unselected node must highlight it while the button is still down, and any
 * drag that follows has to start from the updated selection (both
 * `moveAction` and `cloneAction` read `selection.get()` in their `start`).
 */
export function createSelectPickAction(opts: SelectPickOptions): Action {
  return {
    id: 'select.pick',
    label: 'Select — pick under pointer',
    eligible: { capability: 'creates-selection' },
    requires: ['selection', 'enteredGroup'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as ImmediateParams | undefined;
        const selection = deps.selection;
        if (!selection || !p?.world) return;
        const mods = p.mods ?? { alt: false, ctrl: false, meta: false, shift: false };
        const sel = selection.get();
        const hit = opts.pickHit(p.world, mods.alt, sel);
        if (hit === null) {
          opts.pressed(null);
          return;
        }
        const entered = deps.enteredGroup?.get() ?? null;
        const tree = opts.tree();
        const top = pressTarget(tree, hit, entered);

        // `extendClickLocked` is an option rather than `Action.enabled` because it reads the press's
        // modifiers, and `enabled` is evaluated without them.
        const intent = selection.intentOf(mods);
        const locked = extendPressLocked(intent, mods.shift === true, opts.extendLocked);
        const press = pressDecision(top, sel, extendsSelection(intent), locked, tree);
        if (press.applyNow) applyClickIn(selection, top as NodeId, mods, intent === 'range' ? opts.rangeIn(entered) : undefined);
        opts.pressed(press.deferred);
      },
    },
  };
}

/** `selection.applyClick`, handing it `between` only when there is one. */
export function applyClickIn(selection: SelectionApi, id: NodeId, mods: SelectModifiers, between: Between | undefined): void {
  if (between) selection.applyClick(id, mods, between);
  else selection.applyClick(id, mods);
}
