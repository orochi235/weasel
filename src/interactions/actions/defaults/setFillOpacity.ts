import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { withAlpha01 } from '../../../util/color';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface SetFillOpacityScratch {
  ids: NodeId[];
  scene: Scene<{ fill?: string }, string, unknown>;
  /** Data snapshot at drag start, keyed by node id. */
  startData: Map<NodeId, { fill?: string }>;
  /** The most-recently-received alpha value (0..1, clamped by withAlpha01). */
  currentAlpha: number;
  /** Preview data entries — updated fill per selected node.
   *  Populated on start and refreshed on every onMove. */
  previews: Map<NodeId, { fill: string }>;
}

/** Refresh the preview map from `scratch.currentAlpha` and `startData`. */
function refreshPreviews(scratch: SetFillOpacityScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    const next = withAlpha01(prev?.fill ?? '#ffffffff', scratch.currentAlpha);
    scratch.previews.set(id, { ...(prev ?? {}), fill: next });
  }
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * Static descriptor for the `setFillOpacity` Action.
 *
 * Ongoing-timing action: on start captures per-node data; on each onMove
 * updates preview fill alpha without touching the scene; on commit writes a
 * single batched `scene.update` per selected node so only one undo entry is
 * created.
 *
 * Alpha semantics: `params.alpha01` (0..1) replaces the alpha channel of each
 * node's existing fill while preserving the RGB. Clamping is delegated to
 * `withAlpha01`.
 */
export const setFillOpacityAction: Action & { requires: string[] } = {
  id: 'setFillOpacity',
  label: 'Set fill opacity',
  eligible: { capability: 'applies-fill' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<{ fill?: string }, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Resolve initial alpha: prefer ctx.params, fall back to opts.params.
      const ctxAlpha = ctx.params?.alpha01 as number | undefined;
      const optsAlpha = (opts?.params as { alpha01?: number } | undefined)?.alpha01;
      const initialAlpha = ctxAlpha ?? optsAlpha ?? 1;

      // Snapshot node data at drag start.
      const startData = new Map<NodeId, { fill?: string }>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as { fill?: string }) });
      }

      const scratch: SetFillOpacityScratch = {
        ids,
        scene,
        startData,
        currentAlpha: initialAlpha,
        previews: new Map(),
      };
      refreshPreviews(scratch);

      return {
        onMove(moveCtx: InvocationCtx): void {
          const next = moveCtx.params?.alpha01 as number | undefined;
          if (next === undefined) return;
          scratch.currentAlpha = next;
          refreshPreviews(scratch);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          scratch.scene.batch('Set fill opacity', () => {
            for (const id of scratch.ids) {
              const prev = scratch.startData.get(id);
              const next = withAlpha01(prev?.fill ?? '#ffffffff', scratch.currentAlpha);
              // Re-read so concurrent edits to non-fill fields aren't clobbered on commit.
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow) continue;
              scratch.scene.update(id, {
                data: { ...(nodeNow.data as object), fill: next } as never,
              });
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewData: (id: string) => scratch.previews.get(id as unknown as NodeId) ?? null,
      };
    },
  },
  enabled: (deps) => {
    const sel = deps?.selection as SelectionApi | undefined;
    if (!sel || (sel.get() as unknown[]).length === 0) {
      return ActionDisabledReason.SelectionRequired;
    }
    return true;
  },
};
