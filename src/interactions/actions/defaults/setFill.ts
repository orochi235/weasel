import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { mergeAlphaFromPrev } from '../../../util/color';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface SetFillScratch {
  ids: NodeId[];
  scene: Scene<{ fill?: string }, string, unknown>;
  /** Data snapshot at drag start, keyed by node id. */
  startData: Map<NodeId, { fill?: string }>;
  /** The most-recently-received color string (may be 6- or 8-char hex). */
  currentColor: string;
  /** Preview data entries — merged fill per selected node.
   *  Populated on start and refreshed on every onMove. */
  previews: Map<NodeId, { fill: string }>;
}

/** Refresh the preview map from `scratch.currentColor` and `startData`. */
function refreshPreviews(scratch: SetFillScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    const next = mergeAlphaFromPrev(scratch.currentColor, prev?.fill ?? '#ffffffff');
    scratch.previews.set(id, { ...(prev ?? {}), fill: next });
  }
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * Static descriptor for the `setFill` Action.
 *
 * Ongoing-timing action: on start captures per-node data; on each onMove
 * updates preview fill without touching the scene; on commit writes a single
 * batched `scene.update` per selected node so only one undo entry is created.
 *
 * Alpha semantics: a 6-char (no-alpha) color adopts the alpha from the node's
 * existing fill. An 8-char color keeps its own alpha.
 */
export const setFillAction: Action & { requires: string[] } = {
  id: 'setFill',
  label: 'Set fill',
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

      // Resolve initial color: prefer ctx.params, fall back to opts.params.
      const ctxColor = ctx.params?.color as string | undefined;
      const optsColor = (opts?.params as { color?: string } | undefined)?.color;
      const initialColor = ctxColor ?? optsColor ?? '#000000ff';

      // Snapshot node data at drag start.
      const startData = new Map<NodeId, { fill?: string }>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as { fill?: string }) });
      }

      const scratch: SetFillScratch = {
        ids,
        scene,
        startData,
        currentColor: initialColor,
        previews: new Map(),
      };
      refreshPreviews(scratch);

      return {
        onMove(moveCtx: InvocationCtx): void {
          const next = moveCtx.params?.color as string | undefined;
          if (next === undefined) return;
          scratch.currentColor = next;
          refreshPreviews(scratch);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          scratch.scene.batch('Set fill', () => {
            for (const id of scratch.ids) {
              const prev = scratch.startData.get(id);
              const merged = mergeAlphaFromPrev(scratch.currentColor, prev?.fill ?? '#ffffffff');
              // Re-read so concurrent edits to non-fill fields aren't clobbered on commit.
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow) continue;
              scratch.scene.update(id, {
                data: { ...(nodeNow.data as object), fill: merged } as never,
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
