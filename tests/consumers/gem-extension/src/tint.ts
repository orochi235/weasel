// #region tint-action
import { commitOps, createSetDataOp, defineAction, defineTool, resolveParams } from '@weasel-js/core';
import { isGem, type GemData } from './gem.js';

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    /** How far the pointer travels, in world units, to step to the next color. */
    'gem.tint': { step: number };
  }
}

export const GEM_PALETTE = ['#3a7bd5', '#d53a7b', '#7bd53a', '#d5a13a'] as const;

/** `color` moved `steps` places along {@link GEM_PALETTE}, wrapping; a color off the palette starts from its first. */
export function tintedBy(color: string, steps: number): string {
  const at = Math.max(0, GEM_PALETTE.indexOf(color as (typeof GEM_PALETTE)[number]));
  const n = GEM_PALETTE.length;
  return GEM_PALETTE[(((at + steps) % n) + n) % n]!;
}

/** Dragging sideways over the selected gems steps their color along the palette, previewing as it goes. */
export const tintAction = defineAction({
  id: 'gem.tint',
  label: 'Tint gem',
  requires: ['scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'ongoing',
    start: (ctx, opts) => {
      const step = resolveParams(opts?.params)?.step ?? 24;
      const scene = ctx.deps.scene;
      const gems = new Map<string, GemData>();
      for (const id of ctx.deps.selection?.get() ?? []) {
        const data = scene?.get(id)?.data;
        if (isGem(data)) gems.set(id, data);
      }
      let steps = 0;
      const tinted = (data: GemData): GemData => ({ gem: { ...data.gem, color: tintedBy(data.gem.color, steps) } });
      return {
        kind: 'gem.tint',
        onMove: (m) => { steps = Math.round((m.world.x - ctx.world.x) / step); },
        previewIds: () => (steps === 0 ? null : gems.keys()),
        previewData: (id) => {
          const data = gems.get(id);
          return data ? tinted(data) : null;
        },
        onEnd: (_end, reason) => {
          if (reason === 'cancel' || steps === 0) return;
          const ops = [...gems].map(([id, from]) => createSetDataOp({ id, from, to: tinted(from) }));
          // The standard commit, through the deps `start` was given: `onMove` and `onEnd` get an empty bag.
          // It goes to the host's `applyOps` when there is one, else straight to the scene.
          commitOps(ctx.deps, ops, 'Tint gem');
        },
      };
    },
  },
});
// #endregion tint-action

// #region tint-tool
export const tintTool = defineTool({
  id: 'tint',
  cursor: 'ew-resize',
  presentation: { label: 'Tint', group: 'edit' },
  actions: [tintAction],
  bindings: [{ spec: { kind: 'drag', target: 'kind:gem:selected' }, actionId: 'gem.tint', opts: { params: { step: 24 } } }],
});
// #endregion tint-tool
