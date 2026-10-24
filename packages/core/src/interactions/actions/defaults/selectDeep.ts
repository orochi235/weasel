import type { Action } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';

type Mods = { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };

export interface SelectDeepOptions {
  /** The node under the point, past every group. Locked nodes are the
   *  picker's to skip, as they are for `select.pick`. */
  pickHit: (worldX: number, worldY: number, alt: boolean, selection: readonly string[]) => string | null;
  /** True when an extend press must leave the selection alone. */
  extendLocked: () => boolean;
  /** Called once the press is handled, so a deferral left by an earlier press cannot fire on release. */
  settled: () => void;
}

/**
 * `select.deep` — selects the node under the point itself, not the outermost
 * group above it; with Shift it adds that node. Bound to Cmd-press by
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
        const p = params as { worldX?: number; worldY?: number; mods?: Mods } | undefined;
        const selection = deps.selection;
        if (!selection || p?.worldX === undefined || p.worldY === undefined) return;
        const shift = p.mods?.shift === true;
        const hit = opts.pickHit(p.worldX, p.worldY, p.mods?.alt === true, selection.get());
        opts.settled();
        if (hit === null || (shift && opts.extendLocked())) return;
        selection.applyClick(hit as NodeId, { ctrl: false, meta: false, shift });
      },
    },
  };
}
