import { useMemo, useRef } from 'react';
import { useResize, type UseResizeOptions } from 'interactions/gestures/resize/resize';
import { composeAffordanceLayer } from 'affordances/composeAffordanceLayer';
import {
  createCornerResizeAffordance,
  type CornerResizeScratch,
} from 'affordances/cornerResize';
import type { Affordance, AffordanceBinding } from 'affordances/types';
import type { ResizeAdapter } from 'core/adapters/types';
import { defineTool } from '../../routing';
import type { Tool, ToolBounds } from '../../types';
import type { RenderLayer } from 'core/layers/render';
import { createTransformOp } from 'core/ops/transform';
import { RECT_POSE_DESCRIPTOR } from 'interactions/gestures/resize/geometry';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';

export interface UseResizeToolOptions<TNode extends { id: string }, TPose> {
  /** Resize gesture options forwarded to `useResize`. */
  resize?: UseResizeOptions<TPose>;
  /** Square hit-radius for corner resize handles. Default: 8. */
  handleHitRadius?: number;
  /** World-space bounds lookup for a node id. Used for the
   *  `MULTI_RESIZE_TARGET_ID` union synthesis. The corner-resize affordance
   *  itself reads bounds via the dispatcher-supplied ChromeState; this hook
   *  exposes the option so multi-selection bound aggregation has a source.
   *  When omitted, defaults to `poseBounds(adapter.getPose(id))`. */
  boundsOf?: (id: string) => Bounds | null;
  /** Returns the live selection ids. Used by the
   *  `MULTI_RESIZE_TARGET_ID` previewBounds synthesis. Without it, the
   *  synthetic id resolves to `null`. */
  getSelection?: () => readonly string[];
  /** Project a pose to its AABB. Default: identity (works for poses that
   *  carry top-level `x`/`y`/`width`/`height`). Used as the leaf
   *  projection during in-flight `MULTI_RESIZE_TARGET_ID` union synthesis
   *  so the union AABB tracks the live preview pose. */
  poseBounds?: (pose: TPose) => Bounds;
  /** Node lookup. Retained for parity with `useSelectTool` and for future
   *  ghost-render wiring; the corner affordance does not need it directly
   *  because ChromeState supplies the bounds. */
  getNode?: (id: string) => TNode | null;
}

/** Resize-only Tool. Owns:
 *   - the `useResize` gesture controller
 *   - the corner-resize affordance, including its multi-mode union branch
 *   - a placeholder ghost overlay layer (decorative; emits nothing until a
 *     consumer-supplied draw is wired in a later task)
 *   - the `MULTI_RESIZE_TARGET_ID` previewBounds synthesis
 *
 *  No `pointerDown` / `drag` / `click` / `dblTap` routes — resize is
 *  exclusively affordance-driven. The dispatcher routes corner-handle hits
 *  through this tool's `overlay` (which composes the affordance layer) into
 *  the wrapped drag channel below. */
export function useResizeTool<TNode extends { id: string }, TPose>(
  adapter: ResizeAdapter<TNode, TPose>,
  options: UseResizeToolOptions<TNode, TPose>,
): Tool<unknown> & {
  overlay: RenderLayer<unknown>;
  previewPose: (id: string) => TPose | null;
  previewBounds: (id: string) => ToolBounds | null;
  previewIds: () => Iterable<string> | null;
} {
  const resize = useResize<TNode, TPose>(adapter, options.resize ?? {});

  const handleHitRadius = options.handleHitRadius ?? 8;

  // Latest-callback ref for the resize controller — the affordance's
  // wrapped drag channel closes over this so we don't have to rebuild the
  // wrapper every render. Mirrors useSelectTool's pattern.
  const resizeRef = useRef(resize);
  resizeRef.current = resize;

  // Pose→bounds projection. Identity default works when TPose extends
  // Bounds (the common rect-pose case). Used by the MULTI_RESIZE_TARGET_ID
  // synthesis to prefer the in-flight preview pose over committed bounds.
  const poseBoundsFn = options.poseBounds ?? ((p: TPose) => p as unknown as Bounds);
  // boundsOf fallback — when not provided, derive from adapter.getPose.
  // Used by the MULTI_RESIZE_TARGET_ID union synthesis for ids that have
  // no in-flight preview pose.
  const boundsOfFn = options.boundsOf ?? ((id: string): Bounds | null => {
    try {
      return poseBoundsFn(adapter.getPose(id));
    } catch {
      return null;
    }
  });

  // Latest-callback refs so the overlay/synthesis closures see the most
  // recent option closures without rebuilding the Tool record.
  const boundsOfRef = useRef(boundsOfFn);
  boundsOfRef.current = boundsOfFn;
  const getSelectionRef = useRef(options.getSelection);
  getSelectionRef.current = options.getSelection;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  // Corner-resize affordance. Defaults to the same `handleHitRadius` the
  // tool exposes so the affordance's hit math matches what users configure.
  const cornerAff = useMemo(
    () => createCornerResizeAffordance({ handleHitRadius }),
    [handleHitRadius],
  );

  // Wrap the affordance's hitTest to substitute its stub drag channel with
  // one that delegates to `useResize`. Single-mode delegates directly; the
  // synthetic `MULTI_RESIZE_TARGET_ID` target snapshots union + per-leaf
  // poses at hit-time and applies `RECT_POSE_DESCRIPTOR.remapBounds` per
  // leaf via `adapter.applyOps`. Render returns [] — the affordance layer
  // composer paints corner glyphs via `cornerAff.render` (`composeAffordanceLayer`
  // walks the original affordance's render, not the wrapper's). We override
  // hitTest here, not render, so this wrapper is hit-only.
  const cornerAffWrapped: Affordance = useMemo(
    () => ({
      id: cornerAff.id,
      render: () => [],
      hitTest: (wx, wy, state, view): AffordanceBinding | null => {
        const inner = cornerAff.hitTest?.(wx, wy, state, view);
        if (!inner) return null;
        const scratch = inner.initialScratch as CornerResizeScratch;

        // Multi-mode: synthesize the resize gesture here in the wrapper.
        // useResize doesn't natively handle MULTI_RESIZE_TARGET_ID; we
        // snapshot the union AABB + per-leaf poses at hit-time, then on
        // each move compute a `dst` union from the anchor + pointer
        // delta and apply remapBounds per leaf via transient applyOps.
        // On end, commit one batched Transform op per leaf so undo
        // collapses the gesture into a single history entry.
        if (scratch.targetId === MULTI_RESIZE_TARGET_ID) {
          if (!state.unionBounds || state.selection.length < 2) return null;
          const startUnion = { ...state.unionBounds };
          const a = adapterRef.current;
          // Snapshot every leaf's pose at gesture start.
          const startPoses = new Map<string, TPose>();
          for (const id of state.selection) {
            try {
              startPoses.set(id, a.getPose(id));
            } catch {
              // Skip ids whose pose isn't readable.
            }
          }
          if (startPoses.size === 0) return null;

          // Compute the dst union given the anchor + new pointer position.
          // The anchor pins the corner OPPOSITE the dragged handle:
          //   anchor.x='min' → left edge fixed, right edge moves with pointer.
          //   anchor.x='max' → right edge fixed, left edge moves.
          // Same for y.
          const dstFor = (pointerX: number, pointerY: number): {
            x: number; y: number; width: number; height: number;
          } => {
            const left = scratch.anchor.x === 'min' ? startUnion.x : pointerX;
            const right = scratch.anchor.x === 'min' ? pointerX : startUnion.x + startUnion.width;
            const top = scratch.anchor.y === 'min' ? startUnion.y : pointerY;
            const bottom = scratch.anchor.y === 'min' ? pointerY : startUnion.y + startUnion.height;
            return {
              x: Math.min(left, right),
              y: Math.min(top, bottom),
              width: Math.abs(right - left),
              height: Math.abs(bottom - top),
            };
          };

          // Apply the per-leaf remap from startUnion → dst via the kit's
          // pose descriptor. RECT_POSE_DESCRIPTOR works for any pose
          // shape that's structurally Bounds-like — the demos we ship
          // all use rect poses, so this is fine for v1.
          const applyAt = (pointerX: number, pointerY: number, transient: boolean) => {
            const dst = dstFor(pointerX, pointerY);
            const ops = [];
            for (const [id, from] of startPoses) {
              const to = RECT_POSE_DESCRIPTOR.remapBounds(
                from as unknown as { x: number; y: number; width: number; height: number },
                startUnion,
                dst,
              ) as unknown as TPose;
              ops.push(createTransformOp<TPose>({ id, from, to }));
            }
            if (ops.length === 0) return;
            // IMPORTANT: invoke as method calls so `this` binds to the
            // adapter — `sceneToAdapter`'s `applyOps` reads `this.setPose`
            // inside its `scene.batch` callback. Extracting the function
            // and calling it detached throws "Cannot read properties of
            // undefined (reading 'setPose')" mid-onEnd.
            const aa = a as {
              applyOps?: (ops: ReturnType<typeof createTransformOp>[], label?: string) => void;
            };
            if (transient) {
              aa.applyOps?.(ops);
            } else {
              aa.applyOps?.(ops, 'Resize');
            }
          };

          let lastPointer = { x: 0, y: 0 };
          const result: AffordanceBinding<CornerResizeScratch> = {
            drag: {
              onStart: (_e, dctx) => {
                lastPointer = { x: dctx.worldX, y: dctx.worldY };
                // Don't apply on start — the pointer is at the handle
                // corner, so dst === startUnion (no-op).
                return 'claim';
              },
              onMove: (_e, dctx) => {
                lastPointer = { x: dctx.worldX, y: dctx.worldY };
                applyAt(dctx.worldX, dctx.worldY, /* transient */ true);
                return 'claim';
              },
              onEnd: (_e, _dctx) => {
                // Commit the final pose via applyOps for a single undo
                // entry. Transient writes during move have already landed;
                // this re-applies the same final transform through the
                // history path.
                applyAt(lastPointer.x, lastPointer.y, /* transient */ false);
                return 'claim';
              },
              onCancel: () => {
                // Roll back to the start poses via a transient apply.
                const ops = [];
                for (const [id, from] of startPoses) {
                  ops.push(createTransformOp<TPose>({ id, from, to: from }));
                }
                if (ops.length > 0) {
                  (a as { applyOps?: (ops: ReturnType<typeof createTransformOp>[]) => void }).applyOps?.(ops);
                }
              },
            },
            initialScratch: scratch,
          };
          return result as AffordanceBinding;
        }

        // Single-selection path: delegate to useResize.
        const result: AffordanceBinding<CornerResizeScratch> = {
          drag: {
            onStart: (_e, dctx) => {
              resizeRef.current.start(scratch.targetId, scratch.anchor, dctx.worldX, dctx.worldY);
              return 'claim';
            },
            onMove: (_e, dctx) => {
              resizeRef.current.move(dctx.worldX, dctx.worldY, dctx.modifiers);
              return 'claim';
            },
            onEnd: (_e, _dctx) => {
              resizeRef.current.end();
              return 'claim';
            },
            onCancel: () => {
              resizeRef.current.cancel();
            },
          },
          initialScratch: scratch,
        };
        return result as AffordanceBinding;
      },
    }),
    [cornerAff],
  );

  // Affordance overlay layer. The composer paints `cornerAff.render`
  // glyphs and routes hit-tests through `cornerAffWrapped.hitTest`.
  const affordanceOverlay = useMemo(
    () => composeAffordanceLayer('resize-affordances', 'Resize affordances', [
      cornerAffWrapped,
    ]),
    [cornerAffWrapped],
  );

  // Ghost overlay slice. Structural placeholder for the resize ghost —
  // currently emits nothing because this tool's option surface doesn't
  // include a `drawGhost`/`getNode` ghost-render pair (`useSelectTool`
  // still owns ghost rendering today). When a later task wires
  // consumer-supplied ghost rendering through this tool, the resize
  // ghost slice from useSelectTool's `ghostOverlay` (lines ~386-389)
  // moves into the draw body below.
  const ghostOverlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'resize-overlay-ghosts',
      label: 'Resize overlay ghosts',
      space: 'screen',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      draw: (_data, _view, _dims) => {
        // No-op until ghost-render options are added. Reading
        // `resize.overlay` here without a draw target would just allocate
        // and discard.
        return [];
      },
    }),
    [],
  );

  // Combined Tool overlay: ghost layer (bottom) + affordance layer (top).
  // hitTest comes from the affordance layer so dispatcher-side hit-test
  // pipelines can route corner-handle hits through it. Ghosts have no
  // hitTest of their own.
  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'resize-overlay',
      label: 'Resize overlay',
      space: 'screen',
      draw: (data, view, dims) => {
        const ghosts = ghostOverlay.draw(data, view, dims);
        const aff = affordanceOverlay.draw(data as never, view, dims);
        return [...ghosts, ...aff];
      },
      hitTest: (wx, wy, data, view, dims) =>
        affordanceOverlay.hitTest(wx, wy, data as never, view, dims),
    }),
    [ghostOverlay, affordanceOverlay],
  );

  // previewPose: surface the resize controller's in-flight pose for the
  // dragged id (and any leaf poses it republishes during a group resize).
  // Returns null when no resize is in flight or `id` isn't covered.
  const previewPose = (id: string): TPose | null => {
    const rOv = resize.overlay;
    if (!rOv) return null;
    if (rOv.id === id) return rOv.currentPose as TPose;
    const leaf = rOv.leafPoses?.get(id);
    if (leaf !== undefined) return leaf as TPose;
    return null;
  };

  // previewBounds: synthesize the multi-union AABB for the synthetic
  // `MULTI_RESIZE_TARGET_ID` from `boundsOf` over the live selection.
  // Returns null for any other id (consumers fall through to other tools'
  // previewBounds / previewPose / committed adapter pose).
  const previewBounds = (id: string): ToolBounds | null => {
    if (id !== MULTI_RESIZE_TARGET_ID) return null;
    const getSelection = getSelectionRef.current;
    if (!getSelection) return null;
    const ids = getSelection();
    if (ids.length < 2) return null;
    const bof = boundsOfRef.current;
    // Prefer per-leaf preview pose during a drag (so the union AABB tracks
    // the in-flight resize overlay); fall back to committed bounds otherwise.
    const leafBounds = (sid: string): Bounds | null => {
      const p = previewPose(sid);
      if (p != null) return poseBoundsFn(p);
      return bof(sid);
    };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let any = false;
    for (const sid of ids) {
      const b = leafBounds(sid);
      if (!b) continue;
      any = true;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    }
    if (!any) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  // previewIds: every id whose committed paint should be suppressed while
  // a resize gesture is in flight. Mirrors the resize slice of
  // useSelectTool's previewIds.
  const previewIds = (): Iterable<string> | null => {
    const out = new Set<string>();
    const rOv = resize.overlay;
    if (rOv) {
      out.add(rOv.id);
      if (rOv.leafPoses) for (const id of rOv.leafPoses.keys()) out.add(id);
    }
    return out.size > 0 ? out : null;
  };

  return useMemo(
    () => {
      const base = defineTool<unknown>({
        id: 'resize',
        // No keybinding — resize is affordance-driven, not tool-switched.
        cursor: () => 'default',
        presentation: {
          label: 'Resize',
          group: 'select',
        },
        // No pointerDown/drag/click/dblTap routes: the corner-resize
        // affordance hit-test routes the gesture directly into useResize
        // (or the multi-mode wrapper above) via the dispatcher's
        // affordance-layer pipeline. Resize never participates in body-hit
        // classification.
        initial: {},
      });
      return {
        ...base,
        overlay,
        previewPose,
        previewBounds,
        previewIds,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resize, overlay, handleHitRadius],
  );
}
