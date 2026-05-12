import { useMemo, useRef, createElement } from 'react';
import { SelectIcon } from '../../icons';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import type { Path } from 'features/paths/types';
import { useMove, type UseMoveOptions } from 'interactions/gestures/move/move';
import { useResize, type UseResizeOptions } from 'interactions/gestures/resize/resize';
import { useRotate, type UseRotateOptions } from 'interactions/gestures/rotate/rotate';
import { useAreaSelect, type UseAreaSelectOptions } from 'interactions/gestures/area-select/areaSelect';
import { composeAffordanceLayer } from 'affordances/composeAffordanceLayer';
import {
  createCornerResizeAffordance,
  type CornerResizeScratch,
} from 'affordances/cornerResize';
import {
  createRotationAffordance,
  type RotationScratch,
} from 'affordances/rotationHandle';
import type { Affordance, AffordanceBinding } from 'affordances/types';
import type { MoveAdapter } from 'core/adapters/types';
import type { ResizeAdapter } from 'core/adapters/types';
import type { RotateAdapter } from 'core/adapters/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import type { ResizeAnchor } from 'interactions/gestures/types';
import type { NodeId } from 'core/scene/types';
import { defineTool } from '../routing';
import type { ActionFn } from '../routing';
import type { Tool, ToolBounds, ToolCtx } from '../types';
import type { DebugSink } from '../../debug/types';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { viewToMat3, type DrawCommand } from '../../renderer';
import { pickTopMostHit } from './pickTopMostHit';
import { createReorderOp } from 'core/ops/reorder';
import { createTransformOp } from 'core/ops/transform';
import { RECT_POSE_DESCRIPTOR } from 'interactions/gestures/resize/geometry';
import { dispatchApplyBatch } from 'core/applyOps';

/** World-space bounding rect for hit-testing handles. Uses `width`/`height` to
 *  match `cornerResizeHandles` and `rotationHandle` expectations. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Synthetic id used by `<Canvas selectionMode="multi">` to address the
 *  union-AABB target when 2+ real ids are selected. The selection-overlay
 *  layer asks `previewBounds(MULTI_RESIZE_TARGET_ID)` for the union rect; the
 *  select tool synthesizes it from `getSelection()` + `boundsOf` so callers
 *  don't have to special-case it. Exported so `Canvas.tsx` (and any consumer
 *  wiring its own selection-overlay layer) can reference the same constant. */
export const MULTI_RESIZE_TARGET_ID = '__weasel:multi-selection';

export interface AreaSelectOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

export interface MoveOverlayStyle {
  ghostAlpha?: number;
}

export interface ResizeOverlayStyle {
  ghostAlpha?: number;
}

export interface RotateOverlayStyle {
  ghostAlpha?: number;
}

export interface UseSelectToolOptions<TNode extends { id: string }, TPose> {
  /** Return ids of all objects whose painted body covers (worldX, worldY).
   *  Order doesn't matter — the tool collapses parent/child overlap via
   *  `pickTopMostHit`. When omitted, defaults to a rect AABB-vs-point scan
   *  over `adapter.getNodes()` using `poseBounds` (identity by default,
   *  works for `{x,y,width,height}` poses). Override for tighter shapes
   *  (path / polygon hit-tests). */
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** Optional alt-aware selection-update hit returning the single id the
   *  click should act on. When set, `pointer.onDown` routes the body-hit
   *  branch through this instead of `pickTopMostHit(pickEvery(...))` — used by
   *  nested-group consumers to resolve clicks to the outermost ancestor by
   *  default and drill one level deeper per alt-click. Receives the live
   *  selection so the drill step knows where to start. Returning `null`
   *  means "no body hit". When omitted, the tool uses
   *  `pickTopMostHit(pickEvery(...))`. */
  pickBest?: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
  /** Return the world-space bounds of `id`, or null if not found. When
   *  omitted, defaults to `poseBounds(adapter.getPose(id))`, mirroring the
   *  default `pickEvery`. Override when your TPose isn't AABB-shaped. */
  boundsOf?: (id: string) => Bounds | null;
  /** Project a pose to its AABB. Default: identity (works for poses that
   *  carry top-level `x`/`y`/`width`/`height`). Used as the fallback
   *  projection for the auto-derived `pickEvery` and `boundsOf`. */
  poseBounds?: (pose: TPose) => Bounds;
  /** Square hit-radius for corner resize handles. Default: 8. */
  handleHitRadius?: number;
  /** Distance from top edge of bounds to rotation handle center. Default: 24. */
  rotationHandleDistance?: number;
  move?: UseMoveOptions<TPose>;
  resize?: UseResizeOptions<TPose>;
  rotate?: UseRotateOptions<TPose>;
  areaSelect?: UseAreaSelectOptions;
  /** Optional debug sink. When supplied, records corner-handle and
   *  rotation-handle hitboxes at the same sites as the hit checks (so the
   *  overlay shows what the select tool actually evaluates). Tree-shakes
   *  via optional-chain when omitted. */
  debug?: DebugSink;
  /** Style for the area-select marquee. */
  areaSelectOverlayStyle?: AreaSelectOverlayStyle;
  /** Style for the move ghost (currently just `ghostAlpha`). */
  moveOverlayStyle?: MoveOverlayStyle;
  /** Style for the resize ghost. Falls back to `moveOverlayStyle.ghostAlpha`
   *  if unset, then to a default of 0.85. */
  resizeOverlayStyle?: ResizeOverlayStyle;
  /** Style for the rotate ghost. Same fallback chain as `resizeOverlayStyle`. */
  rotateOverlayStyle?: RotateOverlayStyle;
  /** Consumer's draw function for ghost objects (move/resize/rotate in-flight).
   *  Returns world-space DrawCommand[] for one ghost. If omitted, ghosts are
   *  not rendered (only the marquee draws). Optional only because some demos
   *  (e.g. NestedGroupsDemo) compose ghosts via custom layers. */
  drawGhost?: (
    obj: TNode | null,
    pose: TPose,
    view: { x: number; y: number; scale: number },
  ) => DrawCommand[];
  /** Object lookup for the ghost render, paired with `drawGhost`. Optional. */
  getNode?: (id: string) => TNode | null;
  /** Returns the live selection ids. When supplied, `previewBounds` synthesizes
   *  the multi-union AABB for `MULTI_RESIZE_TARGET_ID` from `boundsOf` of each
   *  selected id — used by `<Canvas selectionMode="multi">`'s selection-overlay
   *  layer when 2+ ids are selected. Without it, the synthetic id resolves to
   *  `null` and consumers wiring multi-mode must compute the union themselves.
   *  `<SceneCanvas>` wires this automatically from its `selection` prop. */
  getSelection?: () => readonly string[];
  /** Optional double-tap hook. When the dispatcher detects a double-tap (two
   *  sub-threshold clicks within `dblTap.windowMs` / `dblTap.maxDistance`),
   *  this fires with the world-space tap coords and the ids whose body covers
   *  that point (via `pickEvery`). Return value is ignored — internally the
   *  dbl-tap claim suppresses the second `onClick`. Use this to drive modal
   *  entry (e.g. select → edit-anchors) instead of attaching `onDoubleClick`
   *  to a wrapper DOM node. */
  onDoubleTap?: (args: {
    worldX: number;
    worldY: number;
    ids: string[];
    event: PointerEvent;
  }) => void;
  /** Auto-bring-to-front on body-hit click. Default `true` — matches
   *  Figma/Sketch/Illustrator conventions where the most recently clicked
   *  object becomes the topmost in z-order. Disable for apps that want
   *  stable z-order (illustration, CAD-ish tools where ordering carries
   *  semantic meaning). Requires the adapter to expose `getChildren` +
   *  `setChildOrder` — graceful no-op when either is missing. */
  bringToFrontOnSelect?: boolean;
}

/** Intersection of all four sub-controller adapter interfaces.
 *  The narrow adapters share compatible `getNode`/`getPose`/`setPose`/`applyOps`
 *  shapes; `AreaSelectAdapter` adds `hitTestArea`/`applyOps`/`setSelection`/`getSelection`.
 *  No conflicting overloads — intersection is safe. */
type SelectAdapter<TNode extends { id: string }, TPose> =
  MoveAdapter<TNode, TPose>
  & ResizeAdapter<TNode, TPose>
  & RotateAdapter<TNode, TPose>
  & AreaSelectAdapter;

export type SelectScratch =
  | { kind: 'idle' }
  | { kind: 'move'; ids: string[]; deferredClickId: string | null }
  | { kind: 'resize'; targetId: string; anchor: ResizeAnchor }
  | { kind: 'rotate'; targetId: string }
  | { kind: 'area' };

/** Active-slot Tool wrapping `useMove`/`useResize`/`useRotate`/`useAreaSelect`.
 *
 *  Hit-test priority:
 *  1. Affordance layer (rotation handle, corner resize handles) — routed by
 *     the dispatcher's affordance-layer pipeline directly into useRotate /
 *     useResize, bypassing pointer.onDown.
 *  2. pointer.onDown body hit → move + immediate selection.
 *  3. pointer.onDown empty → area-select marquee (or click-to-clear).
 *
 *  `scratch` routes `drag.*` to the matching controller. */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TNode, TPose>,
): Tool<SelectScratch> {
  const move = useMove<TNode, TPose>(adapter, options.move ?? {});
  const resize = useResize<TNode, TPose>(adapter, options.resize ?? {});
  const rotate = useRotate<TNode, TPose>(adapter, options.rotate ?? {});
  // Default to no marquee behaviors. start/move/end still run (so empty-click
  // clear via onClick keeps working) but a drag from empty space doesn't
  // mutate the selection unless the consumer opts in with
  // `areaSelect: { behaviors: [selectFromMarquee()] }`. Most demos don't
  // need marquee selection, and consumers that do should declare it
  // explicitly rather than getting it as an invisible side effect of mounting
  // a select tool.
  const areaSelectOptions = useMemo<UseAreaSelectOptions>(() => {
    const provided = options.areaSelect;
    if (provided?.behaviors) return provided;
    return { ...(provided ?? {}), behaviors: [] };
  }, [options.areaSelect]);
  const areaSelect = useAreaSelect(adapter, areaSelectOptions);

  const handleHitRadius = options.handleHitRadius ?? 8;
  const rotationHandleDistance = options.rotationHandleDistance ?? 24;
  // `options.debug` is still part of the public API (for future affordance
  // hitbox recording), but the inline pointer.onDown hit-tests that used it
  // are gone — both rotation and corner-resize live in affordances now.
  // Reference `options.debug` from the deps array directly to keep linting
  // honest without resurrecting the local alias.

  // Latest-callback ref for the resize controller — the affordance's
  // wrapped drag channel closes over this so we don't have to rebuild the
  // wrapper every render. Mirrors the styleRefs / pickEveryRef pattern.
  const resizeRef = useRef(resize);
  resizeRef.current = resize;

  // Latest-callback ref for `onDoubleTap` so the memoized tool body picks up
  // re-renders without rebuilding the Tool record. Same pattern as `styleRefs`.
  const onDoubleTapRef = useRef(options.onDoubleTap);
  onDoubleTapRef.current = options.onDoubleTap;

  // pickEvery / boundsOf defaults — for any rect-pose adapter the kit can
  // derive both from `adapter.getNodes()` + `adapter.getPose(id)` +
  // poseBounds (identity by default). Consumers override for tighter shapes
  // (e.g. path-pose canvases) or for a domain-specific pick order.
  const poseBoundsFn = options.poseBounds ?? ((p: TPose) => p as unknown as Bounds);
  const pickEveryFn = options.pickEvery ?? ((worldX: number, worldY: number): string[] => {
    // Detect whether the adapter exposes a hierarchical surface (getChildren +
    // getNode). Scene-derived adapters (sceneToAdapter) provide both; plain
    // flat adapters (arrayAdapter) may not. When both are present, perform a
    // clip-aware hierarchical walk so that leaves occluded by an ancestor
    // container's clipFromPose are excluded. When absent, fall back to the
    // original flat scan over getNodes() — same O(n) AABB test as before.
    const hier = adapter as unknown as {
      getNode?: (id: string) => unknown;
      getChildren?: (parentId: string | null) => readonly string[];
    };

    if (typeof hier.getChildren !== 'function' || typeof hier.getNode !== 'function') {
      // Flat-adapter path (no hierarchy surface).
      const out: string[] = [];
      for (const obj of adapter.getNodes()) {
        const b = poseBoundsFn(adapter.getPose(obj.id));
        if (worldX >= b.x && worldX <= b.x + b.width
            && worldY >= b.y && worldY <= b.y + b.height) {
          out.push(obj.id);
        }
      }
      return out;
    }

    // Clip-aware hierarchical walk (analogous to walkClipAware in sceneAdapter,
    // but for point queries using pathContainsPoint instead of pathIntersectsRect).
    const out: string[] = [];

    function walk(parentId: string | null, ancestorClips: readonly Path[]): void {
      nextChild: for (const childId of hier.getChildren!(parentId)) {
        const node = hier.getNode!(childId) as {
          kind?: string;
          clipFromPose?: (pose: TPose) => Path | null;
        };
        const pose = adapter.getPose(childId);

        if (node.kind === 'container') {
          // Compute this container's own clip, if any.
          let ownClip: Path | null = null;
          if (typeof node.clipFromPose === 'function') {
            ownClip = node.clipFromPose(pose);
          }

          // Containers are hit-tested against their AABB, but if the container
          // has a clip the click must also lie within that clip. This mirrors
          // the semantic that clicking outside the visible (clipped) region of
          // a container should not select it.
          const b = poseBoundsFn(pose);
          const inAabb = worldX >= b.x && worldX <= b.x + b.width
              && worldY >= b.y && worldY <= b.y + b.height;
          const inClip = ownClip === null || pathContainsPoint(ownClip, worldX, worldY);
          // Also gate on ancestor clips.
          let passesAncestors = true;
          for (const clip of ancestorClips) {
            if (!pathContainsPoint(clip, worldX, worldY)) { passesAncestors = false; break; }
          }
          if (inAabb && inClip && passesAncestors) {
            out.push(childId);
          }

          // Build child clip chain: append own clip if present.
          const childClips: readonly Path[] =
            ownClip !== null ? [...ancestorClips, ownClip] : ancestorClips;

          walk(childId, childClips);
        } else {
          // Leaf node: skip this leaf (continue to next sibling) if the point
          // lies outside any ancestor clip. Using a labeled continue so we
          // advance the outer childId loop, not the inner clip loop.
          for (const clip of ancestorClips) {
            if (!pathContainsPoint(clip, worldX, worldY)) continue nextChild;
          }
          const b = poseBoundsFn(pose);
          if (worldX >= b.x && worldX <= b.x + b.width
              && worldY >= b.y && worldY <= b.y + b.height) {
            out.push(childId);
          }
        }
      }
    }

    walk(null, []);
    return out;
  });
  const boundsOfFn = options.boundsOf ?? ((id: string): Bounds | null => {
    try {
      return poseBoundsFn(adapter.getPose(id));
    } catch {
      return null;
    }
  });
  const pickEveryRef = useRef(pickEveryFn);
  pickEveryRef.current = pickEveryFn;

  // Refs let the overlay closure pull the latest style/callbacks without
  // rebuilding the Tool record on every render.
  const styleRefs = useRef({
    areaSelectOverlayStyle: options.areaSelectOverlayStyle,
    moveOverlayStyle: options.moveOverlayStyle,
    resizeOverlayStyle: options.resizeOverlayStyle,
    rotateOverlayStyle: options.rotateOverlayStyle,
    drawGhost: options.drawGhost,
    getNode: options.getNode,
  });
  styleRefs.current = {
    areaSelectOverlayStyle: options.areaSelectOverlayStyle,
    moveOverlayStyle: options.moveOverlayStyle,
    resizeOverlayStyle: options.resizeOverlayStyle,
    rotateOverlayStyle: options.rotateOverlayStyle,
    drawGhost: options.drawGhost,
    getNode: options.getNode,
  };

  // Ghost / marquee overlay. Owned by the gesture controllers — these are
  // decorative chrome (move/resize/rotate ghosts + area-select marquee),
  // NOT affordances, so they live outside the affordance layer.
  //
  // The layer is `space: 'screen'`. The marquee branch already lives in
  // screen coords (via `worldToScreen`); ghosts go through `drawGhost`,
  // wrapped in a world-transform group. When `drawGhost` is omitted,
  // ghosts are invisible during drag — fallback consumers can opt in via
  // SceneCanvas's preview-ghost layer driven by scene-slot `drawOne`.
  const ghostOverlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'select-overlay-ghosts',
      label: 'Select overlay ghosts',
      space: 'screen',
      draw: (_data, view) => {
        const refs = styleRefs.current;
        const aOv = areaSelect.overlay;
        if (aOv) {
          const cfg = refs.areaSelectOverlayStyle ?? {};
          const fill = cfg.fill ?? 'rgba(164, 139, 212, 0.18)';
          const stroke = cfg.stroke ?? '#a48bd4';
          const dash = cfg.dash ?? [3, 3];
          const lineWidth = cfg.lineWidth ?? 1;
          const t = viewToTransform(view);
          const x = Math.min(aOv.start.worldX, aOv.current.worldX);
          const y = Math.min(aOv.start.worldY, aOv.current.worldY);
          const w = Math.abs(aOv.current.worldX - aOv.start.worldX);
          const h = Math.abs(aOv.current.worldY - aOv.start.worldY);
          const [sx, sy] = worldToScreen(x, y, t);
          const sw = w * view.scale;
          const sh = h * view.scale;
          return [{
            kind: 'path',
            path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
            fill: { color: fill },
            stroke: { paint: { color: stroke }, width: lineWidth, dash },
          }];
        }

        const drawGhost = refs.drawGhost;
        const getNode = refs.getNode;
        if (!drawGhost || !getNode) return [];
        const moveAlpha = refs.moveOverlayStyle?.ghostAlpha ?? 0.85;
        const resizeAlpha = refs.resizeOverlayStyle?.ghostAlpha ?? moveAlpha;
        const rotateAlpha = refs.rotateOverlayStyle?.ghostAlpha ?? moveAlpha;
        const wrap = (alpha: number, cmds: DrawCommand[]): DrawCommand[] =>
          cmds.length === 0 ? [] : [{ kind: 'group', alpha, transform: viewToMat3(view), children: cmds }];

        const mOv = move.overlay;
        if (mOv) {
          const cmds: DrawCommand[] = [];
          for (const [id, pose] of mOv.poses) {
            for (const c of drawGhost(getNode(id), pose, view)) cmds.push(c);
          }
          return wrap(moveAlpha, cmds);
        }
        const rOv = resize.overlay;
        if (rOv) {
          return wrap(resizeAlpha, drawGhost(getNode(rOv.id), rOv.currentPose, view));
        }
        const rotOv = rotate.overlay;
        if (rotOv) {
          return wrap(rotateAlpha, drawGhost(getNode(rotOv.id), rotOv.currentPose, view));
        }
        return [];
      },
    }),
    [move, resize, rotate, areaSelect],
  );

  // Corner-resize affordance. Defaults to the same `handleHitRadius` the
  // tool exposes so the affordance's hit math matches what users
  // configure (mirroring what the old inline corner-handle test did).
  const cornerAff = useMemo(
    () => createCornerResizeAffordance({ handleHitRadius }),
    [handleHitRadius],
  );

  // Wrap the affordance's hitTest to substitute its stub drag channel
  // with one that delegates to `useResize`. Render returns [] for now —
  // Canvas's existing `selectionOverlay` slot still draws the corner
  // handles via the legacy path; flipping that on (so the affordance
  // becomes the only handle painter) is a Phase 5 task. The hitTest
  // path is the load-bearing piece: it's what lets cross-tool hits
  // (e.g. lasso → corner resize) route to useResize without a slot
  // hand-off.
  //
  // Multi-mode synthetic target (`MULTI_RESIZE_TARGET_ID`) is NOT
  // routed through useResize — the controller doesn't natively handle
  // a synthetic union id. We return null so the affordance pipeline
  // doesn't claim, and the dispatcher falls through to the existing
  // slot-walk pointer.onDown path. Multi-mode corner resize remains a
  // separate concern.
  // Latest-callback ref so the multi-resize drag handlers see the current
  // adapter without rebuilding the wrapper.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

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
            // inside its `scene.batch` callback. Extracting the function and
            // calling it detached throws "Cannot read properties of undefined
            // (reading 'setPose')" mid-onEnd, which the dispatcher can't
            // recover from (inFlight stays set, blocking subsequent gestures).
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
                // Commit the final pose via applyOps for a single
                // undo entry. Transient writes during move have already
                // landed; this re-applies the same final transform
                // through the history path.
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

        // Single-selection path (existing): delegate to useResize.
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

  // Rotation affordance. Same wiring pattern as `cornerAffWrapped`: the
  // affordance owns hit-test geometry, but the drag channel delegates to
  // `useRotate` via a latest-callback ref so we don't rebuild the wrapper
  // every render. Render returns [] to avoid double-painting with the
  // legacy selectionOverlay slot's rotation handle (Canvas still draws it
  // via createSelectionOverlayLayer). Phase 5 flips this back to
  // `rotationAff.render` once the slot is reshaped.
  const rotateRef = useRef(rotate);
  rotateRef.current = rotate;

  const rotationAff = useMemo(
    () => createRotationAffordance({
      distance: rotationHandleDistance,
      handleHitRadius,
    }),
    [rotationHandleDistance, handleHitRadius],
  );

  const rotationAffWrapped: Affordance = useMemo(
    () => ({
      id: rotationAff.id,
      render: () => [],
      hitTest: (wx, wy, state, view): AffordanceBinding | null => {
        const inner = rotationAff.hitTest?.(wx, wy, state, view);
        if (!inner) return null;
        const scratch = inner.initialScratch as RotationScratch;
        // Multi-mode rotation against the synthetic union isn't supported by
        // useRotate today — pass through so the click falls through to the
        // slot walk. Real scene ids drive useRotate normally.
        if (scratch.targetId === MULTI_RESIZE_TARGET_ID) return null;
        const result: AffordanceBinding<RotationScratch> = {
          drag: {
            onStart: (_e, dctx) => {
              rotateRef.current.start({ id: scratch.targetId, worldX: dctx.worldX, worldY: dctx.worldY });
              return 'claim';
            },
            onMove: (_e, dctx) => {
              rotateRef.current.move({ worldX: dctx.worldX, worldY: dctx.worldY, modifiers: dctx.modifiers });
              return 'claim';
            },
            onEnd: (_e, _dctx) => {
              rotateRef.current.end();
              return 'claim';
            },
            onCancel: () => {
              rotateRef.current.cancel();
            },
          },
          initialScratch: scratch,
        };
        return result as AffordanceBinding;
      },
    }),
    [rotationAff],
  );

  // Composite order: corner-resize first, rotation second.
  // `composeAffordanceLayer` walks hitTest in REVERSE (last → first), so
  // rotation is tested before corner-resize. That's the right priority —
  // the rotation handle floats above the bounds top, so a hit on it wins
  // over a corner-handle hit on the same point (which shouldn't happen
  // geometrically anyway, but the ordering is defensible).
  const affordanceOverlay = useMemo(
    () => composeAffordanceLayer('select-affordances', 'Select affordances', [
      cornerAffWrapped,
      rotationAffWrapped,
    ]),
    [cornerAffWrapped, rotationAffWrapped],
  );

  // Combined Tool overlay: ghost layer (bottom) + affordance layer (top).
  // hitTest comes from the affordance layer so dispatcher-side hit-test
  // pipelines can route corner-handle hits through it. Ghosts have no
  // hitTest of their own.
  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'select-overlay',
      label: 'Select overlay',
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

  // previewPose: aggregate in-flight overlay poses across move/resize/rotate so
  // Canvas.helpersRef.getEffectivePose can stay overlay-aware without reaching
  // into hook internals. Mirrors the fall-through order in Canvas.tsx's
  // effectivePoseOf — move first (covers multi-id drags), then resize
  // (incl. leaf poses), then rotate.
  const previewPose = (id: string): TPose | null => {
    const mOv = move.overlay;
    if (mOv) {
      const p = mOv.poses.get(id);
      if (p !== undefined) return p as TPose;
    }
    const rOv = resize.overlay;
    if (rOv) {
      if (rOv.id === id) return rOv.currentPose as TPose;
      const leaf = rOv.leafPoses?.get(id);
      if (leaf !== undefined) return leaf as TPose;
    }
    const rotOv = rotate.overlay;
    if (rotOv && rotOv.id === id) return rotOv.currentPose as TPose;
    return null;
  };

  // previewBounds: synthesize the multi-union AABB for the synthetic
  // `MULTI_RESIZE_TARGET_ID` from `boundsOf` over the live selection. Lets
  // `<Canvas selectionMode="multi">`'s selection-overlay layer ask for the
  // union via the standard `tool.previewBounds(id)` channel instead of Canvas
  // having to special-case the synthetic id inline. Returns null for any other
  // id (consumers fall through to `previewPose` → committed adapter pose →
  // geometry.getBounds, same as before).
  const getSelectionRef = useRef(options.getSelection);
  getSelectionRef.current = options.getSelection;
  const boundsOfRef = useRef(boundsOfFn);
  boundsOfRef.current = boundsOfFn;
  const previewBounds = (id: string): ToolBounds | null => {
    if (id !== MULTI_RESIZE_TARGET_ID) return null;
    const getSelection = getSelectionRef.current;
    if (!getSelection) return null;
    const ids = getSelection();
    if (ids.length < 2) return null;
    const bof = boundsOfRef.current;
    // Prefer per-leaf preview pose during a drag (so the union AABB tracks
    // the in-flight move overlay); fall back to committed bounds otherwise.
    // `poseBoundsFn` has an identity default that works when TPose extends
    // Bounds (the common case), so we always have a pose→bounds projection.
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

  // previewIds: every id whose committed paint should be suppressed while a
  // gesture is in flight, so the source doesn't bleed through the ghost. Move
  // contributes its `hideIds` (dragged + cascade descendants); resize/rotate
  // contribute their target id (and any leaf poses they republish via
  // `previewPose`). The standard scene layer skips these ids; SceneCanvas's
  // preview-ghost layer redraws them through the same `drawOne` for visual
  // consistency.
  const previewIds = (): Iterable<string> | null => {
    const out = new Set<string>();
    const mOv = move.overlay;
    if (mOv) for (const id of mOv.hideIds) out.add(id);
    const rOv = resize.overlay;
    if (rOv) {
      out.add(rOv.id);
      if (rOv.leafPoses) for (const id of rOv.leafPoses.keys()) out.add(id);
    }
    const rotOv = rotate.overlay;
    if (rotOv) out.add(rotOv.id);
    return out.size > 0 ? out : null;
  };

  // Imperative shims — partial pre-routing carry-over. Task 3 introduced the
  // routing-factory base; Task 4 migrated `drag` to a declarative route table
  // (see `dragRoutes` below). `pointer.onDown`, `pointer.onClick`, and `dblTap`
  // remain imperative because:
  //
  //   1. pointer.onDown has no routing-factory analogue (factory only emits
  //      pointer.onClick). The onDown logic sets selection / scratch ahead of
  //      drag routing and cannot be deferred to onClick.
  //   2. pointer.onClick handles the deferred-clear / deferred-collapse cases
  //      whose modifier sub-tables need Task 5 work to express declaratively.
  //   3. dblTap.onTap receives a PointerEvent forwarded to the consumer's
  //      onDoubleTap callback; ActionFn<TScratch> only receives ctx.
  //
  // The declarative `initial.drag` route table dispatches by `ctx.target.kind`:
  // rect/text/path → move.beginAt(ids); empty → areaSelect.beginAt. Each
  // gesture primitive owns its own continuation closures (begin/hold/cancel),
  // so the routing factory's engaged phase doesn't need a scratch switch.
  // Behavior preserved end-to-end (multi-select-aware move, deferred click
  // semantics) — the onDown shim sets up the "deferred click" hint on scratch
  // before the dispatcher's threshold gating runs drag.onStart.
  const legacyOnDown = (_e: PointerEvent, ctx: import('../types').ToolCtx<SelectScratch>): 'claim' | 'pass' => {
    const sel = ctx.selection.current;

    // Handles (rotation + corner-resize) are handled by their
    // respective affordances (see `cornerAffWrapped` and
    // `rotationAffWrapped` above). The dispatcher's affordance-layer
    // hit-test pipeline routes those hits directly to `useResize` /
    // `useRotate` via the wrapped drag channels, bypassing
    // pointer.onDown entirely for the handle case.

    // 1. Body hit → move (+ select)
    const top = options.pickBest
      ? options.pickBest(ctx.worldX, ctx.worldY, ctx.modifiers.alt, sel)
      : (() => {
          const ids = pickEveryFn(ctx.worldX, ctx.worldY);
          if (ids.length === 0) return null;
          // pickTopMostHit collapses parent/child overlap (container's
          // bounds also cover the child) and falls back to "last id" for
          // pure sibling hits — matches the bottom-first iteration order
          // most demos produce. Demos that already z-sort with topmost
          // first should return a single-id array; this helper is a
          // no-op in that case.
          return pickTopMostHit(ids, adapter) ?? ids[0];
        })();
    if (top !== null) {
      // Capture pre-click selection so we can decide whether the drag
      // moves the existing set or just the freshly-clicked object.
      // `ctx.selection.current` is the React snapshot from the
      // dispatcher's render — it does not reflect mutations made by
      // applyClick during this same callback.
      const preClick = sel;
      const hitAlreadySelected = preClick.includes(top as NodeId);
      const isExtend = ctx.modifiers.shift || ctx.modifiers.meta;
      // When the hit is already part of a multi-selection and no
      // extend modifier is held, defer the collapse-to-single to
      // onClick. Otherwise applying it on down would wipe the
      // multi-selection before a drag can move the whole set.
      const deferClick = hitAlreadySelected && preClick.length > 1 && !isExtend;
      if (!deferClick) ctx.selection.applyClick(top as NodeId, ctx.modifiers);
      // Auto-bring-to-front on body-hit. Matches Figma / Sketch /
      // Illustrator conventions: the most recently clicked object
      // becomes the topmost in z-order. Skipped on extend-clicks
      // (shift/meta) so multi-selecting doesn't keep reshuffling the
      // stack. Skipped when the adapter doesn't expose the reorder
      // surface — keeps simple flat-list adapters that don't
      // implement getChildren/setChildOrder from accumulating
      // empty "Bring to front" entries on every click.
      if ((options.bringToFrontOnSelect ?? true) && !isExtend) {
        const reorderable = adapter as unknown as {
          getChildren?: (parentId: string | null) => string[];
          setChildOrder?: (parentId: string | null, ids: string[]) => void;
        };
        if (reorderable.getChildren && reorderable.setChildOrder) {
          dispatchApplyBatch(adapter, [createReorderOp({ ids: [top], direction: 'front' })], 'Bring to front');
        }
      }
      // If the user clicked something already selected, drag the whole
      // selection. Otherwise the click switches selection and the drag
      // moves only the clicked object — matches Figma/Sketch behavior
      // ("dragging an unselected object shouldn't move the old one").
      const moveIds: string[] = hitAlreadySelected && preClick.length > 0 ? [...preClick] : [top];
      ctx.scratch = { kind: 'move', ids: moveIds, deferredClickId: deferClick ? top : null };
      return 'claim';
    }

    // 2. Empty → defer clear to onClick (sub-threshold release).
    //    Clearing on down feels twitchy: an accidental tap on empty
    //    space wipes selection mid-thought. The marquee path
    //    (drag.onStart → areaSelect) overwrites selection on its
    //    own end; the click path (no drag) handles clear in
    //    pointer.onClick below. Shift/meta are extend modifiers and
    //    never clear.
    ctx.scratch = { kind: 'area' };
    return 'claim';
  };

  // Compute the ids the move gesture should drag, given the current hit and
  // live selection. Mirrors the rule the imperative `onDown` shim follows when
  // it stashes `scratch.ids`: if the body-hit is part of the existing
  // selection, drag the whole set; otherwise drag just the hit id.
  //
  // `ctx.selection.current` is the React snapshot at dispatch time — it
  // doesn't reflect the `applyClick` the onDown shim has just enqueued, which
  // is what preserves the "drag an unselected rect moves only that rect"
  // semantic. The freshly-clicked id won't yet appear in `selection.current`.
  const computeMoveIds = (ctx: ToolCtx<SelectScratch>): NodeId[] => {
    const hit = ctx.target;
    const hitId = hit?.category === 'node' ? (hit.id as NodeId) : null;
    if (!hitId) return [];
    const selected = ctx.selection.current;
    if (selected.includes(hitId)) return [...selected] as NodeId[];
    return [hitId];
  };

  // Drag route table. Keyed by `ctx.target.kind`:
  //   rect/text/path → move.beginAt(ids); empty → areaSelect.beginAt.
  //
  // beginAt returns a `Result<'begin'>` whose `spec` carries the gesture's
  // continuation closures (onMove/onRelease/onCancel). The routing factory
  // installs those closures into its `activeSpec` slot, so engaged-phase
  // pointer events route through the same gesture primitive without any
  // scratch-kind switch in this file.
  const beginMove: ActionFn<SelectScratch> = (ctx) =>
    move.beginAt(ctx, computeMoveIds(ctx)) as ReturnType<ActionFn<SelectScratch>>;
  const beginArea: ActionFn<SelectScratch> = (ctx) =>
    areaSelect.beginAt(ctx) as ReturnType<ActionFn<SelectScratch>>;

  return useMemo(
    () => {
      // Declarative factory — `initial.drag` is a real route table now.
      // Click and dblTap remain imperative shims (see comment block above).
      const base = defineTool<SelectScratch>({
        id: 'select',
        keybinding: { key: 'V' },
        cursor: 'default',
        presentation: {
          label: 'Select',
          icon: createElement(SelectIcon),
          group: 'select',
        },
        initial: {
          drag: {
            // Per the Phase 3 plan, dispatch by known node kinds so consumers
            // can later override per-kind (e.g. text → enter-edit instead of
            // move). The '*' wildcard catches nodes from adapters that haven't
            // wired `kindOf` yet — kindOf is an optional adapter hook and
            // `Canvas` falls back to `'unknown'` when it's absent. Drag on any
            // node = move is the universal fallback.
            rect: beginMove,
            text: beginMove,
            path: beginMove,
            '*': beginMove,
            empty: beginArea,
          },
        },
      });

      // Patch the remaining imperative handlers on top of the routing
      // skeleton. Each patch fills a gap the routing factory doesn't yet
      // cover (see comment block above the `legacyOnDown` declaration).
      return {
        ...base,
        // The routing factory converts the string cursor to a function;
        // restore the plain string so callers that compare identity work.
        cursor: 'default',
        initScratch: () => ({ kind: 'idle' as const }),
        overlay,
        previewPose,
        previewBounds,
        previewIds,

        pointer: {
          onDown: legacyOnDown,
          onClick: (_e: PointerEvent, ctx: ToolCtx<SelectScratch>): 'claim' | 'pass' => {
            // Sub-threshold release: empty-hit clears, and a body hit on an
            // already-selected member of a multi-selection collapses to that
            // single id (deferred from onDown so a drag could move the set).
            if (ctx.scratch.kind === 'area' && !ctx.modifiers.shift && !ctx.modifiers.meta) {
              ctx.selection.clear();
            } else if (ctx.scratch.kind === 'move' && ctx.scratch.deferredClickId) {
              ctx.selection.applyClick(ctx.scratch.deferredClickId as NodeId, ctx.modifiers);
            }
            return 'claim';
          },
        },

        dblTap: {
          // Shim: PointerEvent forwarded to consumer callback; cannot
          // use ActionFn<TScratch> (only receives ctx). Task 5 / Phase 1
          // follow-up will migrate once ctx carries the event reference.
          onTap: (e: PointerEvent, ctx: ToolCtx<SelectScratch>) => {
            const cb = onDoubleTapRef.current;
            if (!cb) return 'pass' as const;
            const ids = pickEveryRef.current(ctx.worldX, ctx.worldY);
            cb({ worldX: ctx.worldX, worldY: ctx.worldY, ids, event: e });
            return 'claim' as const;
          },
        },

        // drag: handled by the declarative routing factory above. The
        // affordance pipeline (corner-resize / rotation) still routes
        // through `cornerAffWrapped` / `rotationAffWrapped` via a
        // synthetic virtual tool — those paths bypass useSelectTool's
        // drag entirely (see dispatcher's `startAffordanceGesture`).
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [move, resize, rotate, areaSelect, overlay, pickEveryFn, options.pickBest, boundsOfFn, handleHitRadius, rotationHandleDistance, options.debug],
  );
}
