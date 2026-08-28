import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '../invoker';
import { ActionDisabledReason } from '../registry';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import type { FillStyle, Stroke } from 'core/paint-types';
import { createSetDataOp } from 'core/ops/setData';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { paintWithColor, strokeOf, strokeWith } from '../../../util/paint';
import { DEFAULT_STROKE_COLOR } from '../../../util/paint';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

/** Recolor a node's stroke. The stroke keeps its width, cap, join and dash
 *  and its paint takes the new color, so picking a color does not discard the
 *  rest of the stroke. A node with no stroke yet gets a hairline one. */
function strokeWithColor(prev: Stroke | null | undefined, color: string): Stroke {
  if (!prev) return strokeOf(color);
  return { ...prev, paint: paintWithColor(prev.paint, color) };
}

/** Repaint a node's stroke with a whole paint, keeping its width, cap, join
 *  and dash. A node with no stroke yet gets a hairline one. */
function strokeWithPaint(prev: Stroke | null | undefined, paint: FillStyle): Stroke {
  if (!prev) return strokeWith(paint);
  return { ...prev, paint };
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

interface SetStrokeScratch {
  ids: NodeId[];
  scene: Scene<{ stroke?: Stroke | null }, string, unknown>;
  /** Data snapshot at drag start, keyed by node id. */
  startData: Map<NodeId, { stroke?: Stroke | null }>;
  /** The most-recently-received color string (may be 6- or 8-char hex).
   *  Ignored while `currentPaint` is set. */
  currentColor: string;
  /** The most-recently-received non-solid paint, when the caller drives this
   *  action with `paint` instead of `color`. */
  currentPaint?: FillStyle;
  /** Preview data entries — merged stroke per selected node.
   *  Populated on start and refreshed on every onMove. */
  previews: Map<NodeId, { stroke: Stroke }>;
  /** Optional consumer commit hook captured at gesture start. When present,
   *  the ops-based commit routes through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
}

/**
 * The stroke to write for one node.
 *
 * A `paint` replaces the stroke's paint outright. A `color` recolors the
 * existing paint through `paintWithColor`, which keeps that paint's opacity
 * unless the picked color states an alpha of its own. Either way the stroke's
 * structural fields survive.
 */
function resolveStroke(
  scratch: SetStrokeScratch,
  prev: { stroke?: Stroke | null } | undefined,
): Stroke {
  if (scratch.currentPaint) return strokeWithPaint(prev?.stroke, scratch.currentPaint);
  return strokeWithColor(prev?.stroke, scratch.currentColor);
}

/** Refresh the preview map from the scratch's current paint and `startData`. */
function refreshPreviews(scratch: SetStrokeScratch): void {
  scratch.previews.clear();
  for (const id of scratch.ids) {
    const prev = scratch.startData.get(id);
    scratch.previews.set(id, { ...(prev ?? {}), stroke: resolveStroke(scratch, prev) });
  }
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * Static descriptor for the `setStroke` Action.
 *
 * Ongoing-timing action: on start captures per-node data; on each onMove
 * updates preview stroke without touching the scene; on commit emits one
 * `createSetDataOp` per selected node (from = pre-commit data, to = merged
 * stroke) and routes the batch through the consumer `applyOps` hook when present
 * (consumer history) else `scene.applyBatch` + `defaultCommitAdapter` (whose
 * `setData` delegates to `scene.update({ data })`). Either way the whole stroke
 * is one batch → one undo entry, preserving the old `scene.batch('Set stroke', …)`
 * semantics exactly.
 *
 * Takes either `color` (a hex string) or `paint` (a whole `FillStyle`, for
 * gradients and patterns). `paint` wins when both are present. A stroke's
 * width, cap, join, dash and align survive either.
 *
 * Alpha semantics: alpha lives on the stroke paint's `opacity`. A 6-char
 * (no-alpha) color adopts the alpha of the node's existing stroke paint; an
 * 8-char color states its own. A `paint` is written verbatim.
 */
export const setStrokeAction: Action & { requires: string[] } = {
  id: 'setStroke',
  label: 'Set stroke',
  eligible: { capability: 'applies-fill' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<{ stroke?: Stroke | null }, string, unknown> | undefined;
      const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Resolve initial paint: prefer ctx.params, fall back to opts.params.
      const fromCtx = readParams(ctx.params);
      const fromOpts = readParams(opts?.params as Record<string, unknown> | undefined);
      const initialPaint = fromCtx.paint ?? fromOpts.paint;
      const initialColor = fromCtx.color ?? fromOpts.color ?? DEFAULT_STROKE_COLOR;

      // Snapshot node data at drag start.
      const startData = new Map<NodeId, { stroke?: Stroke | null }>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startData.set(id, { ...(node.data as { stroke?: Stroke | null }) });
      }

      const scratch: SetStrokeScratch = {
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
          // data with the merged final stroke — exactly the values the old
          // `scene.update(id, { data: { …nodeNow.data, stroke } })` wrote.
          const ops: Op[] = [];
          for (const id of scratch.ids) {
            const merged = resolveStroke(scratch, scratch.startData.get(id));
            // Re-read so concurrent edits to non-stroke fields aren't clobbered on commit.
            const nodeNow = scratch.scene.get(id);
            if (!nodeNow) continue;
            const from = { ...(nodeNow.data as object) } as { stroke?: Stroke | null };
            const to = { ...from, stroke: merged };
            ops.push(createSetDataOp<{ stroke?: Stroke | null }>({ id: id as string, from, to }));
          }
          if (ops.length > 0) {
            // Route through the consumer hook when present (consumer history,
            // one undo entry there); otherwise commit straight to the scene's
            // own history. Either path is a single batch → one undo entry.
            if (scratch.applyOps) scratch.applyOps(ops, 'Set stroke');
            else scratch.scene.applyBatch(ops, 'Set stroke', defaultCommitAdapter(scratch.scene));
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
