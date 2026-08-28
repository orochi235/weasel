import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { FillStyle } from 'core/paint-types';
import { createSetDataOp } from 'core/ops/setData';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { paintWithColor } from '../../../util/paint';
import { DEFAULT_FILL_COLOR } from '../../../util/paint';

interface SetFillData {
  fill?: FillStyle | null;
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface SetFillScratch {
  ids: NodeId[];
  scene: Scene<SetFillData, string, unknown>;
  /** Data snapshot at drag start, keyed by node id. */
  startData: Map<NodeId, SetFillData>;
  /** The most-recently-received color string (may be 6- or 8-char hex).
   *  Ignored while `currentPaint` is set. */
  currentColor: string;
  /** The most-recently-received non-solid paint, when the caller drives this
   *  action with `paint` instead of `color`. */
  currentPaint?: FillStyle;
  /** Preview data entries — merged fill per selected node.
   *  Populated on start and refreshed on every onMove. */
  previews: Map<NodeId, SetFillData>;
  /** Optional consumer commit hook captured at gesture start. When present,
   *  the ops-based commit routes through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
}

/**
 * The fill to write for one node.
 *
 * A `paint` replaces the fill outright. A `color` recolors the node's
 * existing paint through `paintWithColor`, which keeps that paint's opacity
 * unless the picked color states an alpha of its own.
 */
function resolveFill(scratch: SetFillScratch, prev: SetFillData | undefined): FillStyle {
  if (scratch.currentPaint) return scratch.currentPaint;
  return paintWithColor(prev?.fill ?? undefined, scratch.currentColor);
}

/** Refresh the preview map from the scratch's current paint and `startData`. */
function refreshPreviews(scratch: SetFillScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    scratch.previews.set(id, { ...(prev ?? {}), fill: resolveFill(scratch, prev) });
  }
}

/** Pull whichever of `paint` / `color` a caller supplied out of an
 *  invocation's params. */
function readParams(params: Record<string, unknown> | undefined): {
  color?: string;
  paint?: FillStyle;
} {
  return {
    color: params?.color as string | undefined,
    paint: params?.paint as FillStyle | undefined,
  };
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * Static descriptor for the `setFill` Action.
 *
 * Ongoing-timing action: on start captures per-node data; on each onMove
 * updates preview fill without touching the scene; on commit emits one
 * `createSetDataOp` per selected node (from = pre-commit data, to = merged
 * fill) and routes the batch through the consumer `applyOps` hook when present
 * (consumer history) else `scene.applyBatch` + `defaultCommitAdapter` (whose
 * `setData` delegates to `scene.update({ data })`). Either way the whole fill
 * is one batch → one undo entry, preserving the old `scene.batch('Set fill', …)`
 * semantics exactly.
 *
 * Takes either `color` (a hex string) or `paint` (a whole `FillStyle`, for
 * gradients and patterns). `paint` wins when both are present.
 *
 * Alpha semantics: alpha lives on the paint's `opacity`. A 6-char (no-alpha)
 * color adopts the alpha of the node's existing paint; an 8-char color states
 * its own. A `paint` is written verbatim.
 */
export const setFillAction: Action & { requires: string[] } = {
  id: 'setFill',
  label: 'Set fill',
  eligible: { capability: 'applies-fill' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<SetFillData, string, unknown> | undefined;
      const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Resolve initial paint: prefer ctx.params, fall back to opts.params.
      const fromCtx = readParams(ctx.params);
      const fromOpts = readParams(opts?.params as Record<string, unknown> | undefined);
      const initialPaint = fromCtx.paint ?? fromOpts.paint;
      const initialColor = fromCtx.color ?? fromOpts.color ?? DEFAULT_FILL_COLOR;

      // Snapshot node data at drag start.
      const startData = new Map<NodeId, SetFillData>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as SetFillData) });
      }

      const scratch: SetFillScratch = {
        ids,
        scene,
        startData,
        currentColor: initialColor,
        currentPaint: initialPaint,
        previews: new Map(),
        applyOps,
      };
      refreshPreviews(scratch);

      return {
        onMove(moveCtx: InvocationCtx): void {
          const { color, paint } = readParams(moveCtx.params);
          if (color === undefined && paint === undefined) return;
          if (paint !== undefined) scratch.currentPaint = paint;
          if (color !== undefined) {
            scratch.currentColor = color;
            // An explicit color supersedes a paint from an earlier tick;
            // otherwise a picker drag after a gradient would do nothing.
            if (paint === undefined) scratch.currentPaint = undefined;
          }
          refreshPreviews(scratch);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          // Build one setData op per selected node. `from` is the node's
          // pre-commit data (read here, BEFORE any mutation); `to` is the same
          // data with the merged final fill — exactly the values the old
          // `scene.update(id, { data: { …nodeNow.data, fill } })` wrote.
          const ops: Op[] = [];
          for (const id of scratch.ids) {
            const merged = resolveFill(scratch, scratch.startData.get(id));
            // Re-read so concurrent edits to non-fill fields aren't clobbered on commit.
            const nodeNow = scratch.scene.get(id);
            if (!nodeNow) continue;
            const from = { ...(nodeNow.data as object) } as SetFillData;
            const to = { ...from, fill: merged };
            ops.push(createSetDataOp<SetFillData>({ id: id as string, from, to }));
          }
          if (ops.length > 0) {
            // Route through the consumer hook when present (consumer history,
            // one undo entry there); otherwise commit straight to the scene's
            // own history. Either path is a single batch → one undo entry.
            if (scratch.applyOps) scratch.applyOps(ops, 'Set fill');
            else scratch.scene.applyBatch(ops, 'Set fill', defaultCommitAdapter(scratch.scene));
          }
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
