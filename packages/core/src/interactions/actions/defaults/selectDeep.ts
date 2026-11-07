import type { Action, WorldPoint } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { extendPressLocked } from 'core/selection/extendPressLocked';
import type { ImmediateParams } from '@weasel-js/routing';

export interface SelectDeepOptions {
  /** The node under the point, past every group. Locked nodes are the
   *  picker's to skip, as they are for `select.pick`. */
  pickHit: (world: WorldPoint, alt: boolean, selection: readonly string[]) => string | null;
  /** True when an extend press must leave the selection alone. */
  extendLocked: () => boolean;
  /** Called once the press is handled, so a deferral left by an earlier press cannot fire on release. */
  settled: () => void;
}

/**
 * `select.deep` — selects the node under the point itself, not the outermost
 * group above it; with Shift it applies the click the way the selection's keys read Shift. Bound to Cmd-press by
 * `useSelectTool`, ahead of `select.pick`.
 */
export function createSelectDeepAction(opts: SelectDeepOptions): Action {
  return {
    id: 'select.deep',
    label: 'Select — pick past groups',
    eligible: { capability: 'creates-selection' },
    requires: ['selection'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as ImmediateParams | undefined;
        const selection = deps.selection;
        if (!selection || !p?.world) return;
        // The deep chord is Mod, so only Shift is left to say how the click applies.
        const mods = { ctrl: false, meta: false, shift: p.mods?.shift === true };
        const hit = opts.pickHit(p.world, p.mods?.alt === true, selection.get());
        opts.settled();
        if (hit === null || extendPressLocked(selection.intentOf(mods), mods.shift, opts.extendLocked)) return;
        selection.applyClick(hit as NodeId, mods);
      },
    },
  };
}
