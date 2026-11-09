import type { Action, WorldPoint } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { extendPressLocked } from 'core/selection/extendPressLocked';
import type { ImmediateParams } from '@weasel-js/routing';

export interface SelectDeepOptions {
  /** The node under the point, past every group. Locked nodes are the
   *  picker's to skip, as they are for `select.pick`. */
  pickHit: (world: WorldPoint, alt: boolean, selection: readonly string[], viewId?: string | null) => string | null;
  /** True when an extend press must leave the selection alone. */
  extendLocked: () => boolean;
  /** Called once the press is handled, so a deferral left by an earlier press cannot fire on release. */
  settled: () => void;
  /** What a range to `hit` covers, or undefined to walk the selection's own order. */
  rangeAt?: (hit: string) => ((from: NodeId, to: NodeId) => readonly NodeId[]) | undefined;
}

/**
 * `select.deep` — selects the node under the point itself, not the outermost
 * group above it; with Shift it applies the click the way the selection's keys read Shift, a range
 * covering what `rangeAt` gives. Bound to Cmd+Alt-press by `useSelectTool`, ahead of `select.pick`.
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
        // The deep chord is Mod+Alt, so only Shift is left to say how the click applies.
        const mods = { ctrl: false, meta: false, shift: p.mods?.shift === true };
        const hit = opts.pickHit(p.world, false, selection.get(), p.viewId);
        opts.settled();
        const intent = selection.intentOf(mods);
        if (hit === null || extendPressLocked(intent, mods.shift, opts.extendLocked)) return;
        const between = intent === 'range' ? opts.rangeAt?.(hit) : undefined;
        if (between) selection.applyClick(hit as NodeId, mods, between);
        else selection.applyClick(hit as NodeId, mods);
      },
    },
  };
}
