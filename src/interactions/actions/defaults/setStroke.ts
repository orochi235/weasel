import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { mergeAlphaFromPrev } from '../../../util/color';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface SetStrokeScratch {
  ids: NodeId[];
  scene: Scene<{ stroke?: string }, string, unknown>;
  /** Data snapshot at drag start, keyed by node id. */
  startData: Map<NodeId, { stroke?: string }>;
  /** The most-recently-received color string (may be 6- or 8-char hex). */
  currentColor: string;
  /** Preview data entries — merged stroke per selected node.
   *  Populated on start and refreshed on every onMove. */
  previews: Map<NodeId, { stroke: string }>;
}

/** Refresh the preview map from `scratch.currentColor` and `startData`. */
function refreshPreviews(scratch: SetStrokeScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    const next = mergeAlphaFromPrev(scratch.currentColor, prev?.stroke ?? '#000000ff');
    scratch.previews.set(id, { ...(prev ?? {}), stroke: next });
  }
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * Static descriptor for the `setStroke` Action.
 *
 * Ongoing-timing action: on start captures per-node data; on each onMove
 * updates preview stroke without touching the scene; on commit writes a single
 * batched `scene.update` per selected node so only one undo entry is created.
 *
 * Alpha semantics: a 6-char (no-alpha) color adopts the alpha from the node's
 * existing stroke. An 8-char color keeps its own alpha.
 */
export const setStrokeAction: Action & { requires: string[] } = {
  id: 'setStroke',
  label: 'Set stroke',
  eligible: { capability: 'applies-fill' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<{ stroke?: string }, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Resolve initial color: prefer ctx.params, fall back to opts.params.
      const ctxColor = ctx.params?.color as string | undefined;
      const optsColor = (opts?.params as { color?: string } | undefined)?.color;
      const initialColor = ctxColor ?? optsColor ?? '#000000ff';

      // Snapshot node data at drag start.
      const startData = new Map<NodeId, { stroke?: string }>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as { stroke?: string }) });
      }

      const scratch: SetStrokeScratch = {
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
          scratch.scene.batch('Set stroke', () => {
            for (const id of scratch.ids) {
              const prev = scratch.startData.get(id);
              const merged = mergeAlphaFromPrev(scratch.currentColor, prev?.stroke ?? '#000000ff');
              // Re-read so concurrent edits to non-stroke fields aren't clobbered on commit.
              const nodeNow = scratch.scene.get(id);
              if (!nodeNow) continue;
              scratch.scene.update(id, {
                data: { ...(nodeNow.data as object), stroke: merged } as never,
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
