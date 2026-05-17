/**
 * `resizeAction` — ongoing Action descriptor for anchor-relative drag resize.
 *
 * ## Status: REAL (Phase 12 + 14e)
 *
 * Performs real anchor-relative resize math for rect-shaped poses. Reads
 * `ctx.drag.affordance.anchor` to determine which corner is fixed, captures
 * start poses, applies per-frame bounds remapping, and commits a single
 * `scene.batch` entry on end.
 *
 * ## Behaviors / point-snap / expandIds / geometry — via `resizeBehaviors` dep
 *
 * Phase 14e (resize-behaviors-api) wired the four behavior options the
 * legacy `useResize` hook exposes (`behaviors`, `pointSnapBehaviors`,
 * `expandIds`, `geometry`) through the `resizeBehaviors` dep entry. When
 * the dep is registered, this invoker:
 *
 *  - Calls `expandIds([id])` at start. When the result expands beyond the
 *    starting id, takes the group path (union-AABB origin, per-leaf remap).
 *  - Projects poses through the supplied `geometry: PoseDescriptor<TPose>`
 *    instead of the rect-shaped `RECT_POSE_DESCRIPTOR` default.
 *  - Runs `behaviors[]` after the raw anchor-math bounds are computed.
 *    Behaviors return `{ pose? }` and rewrite the proposed bounds before
 *    they're projected back into pose space.
 *  - Runs `pointSnap[]` after the bounds→pose projection. The first non-null
 *    `PointSnapResult` wins; this invoker back-solves a pose so the chosen
 *    frame's world point lands on the snap target.
 *
 * When the dep is absent the invoker falls back to identity defaults
 * (no behaviors, no snap, `ids => ids` expansion, `RECT_POSE_DESCRIPTOR`),
 * which matches the unrotated rect-pose path the Phase 12 invoker already
 * implemented.
 *
 * @see useResize — the React hook this descriptor mirrors.
 * @see src/interactions/actions/resize/geometry.ts — `PoseDescriptor`.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type {
  GestureContext,
  ModifierState,
  PointSnapBehavior,
  PointSnapContext,
  PointSnapResult,
  ResizeAnchor,
  ResizeBehavior,
  ResizePose,
} from '../../gestures/types';
import type { ResizeBehaviorsDep } from '../depSchema';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../resize/geometry';
import { fixedCornerOf } from '../resize/cornerHandles';
import { rotatePoint } from '../rotate/geometry';

// ---------------------------------------------------------------------------
// Defaults applied when `resizeBehaviors` dep is absent. Mirrors the
// destructuring defaults in `useResize`.
// ---------------------------------------------------------------------------

const IDENTITY_EXPAND = (ids: string[]) => ids;
const EMPTY_BEHAVIORS: ResizeBehavior<ResizePose>[] = [];
const EMPTY_POINT_SNAP: PointSnapBehavior<ResizePose>[] = [];

function resolveDeps(ctx: InvocationCtx): {
  behaviors: ResizeBehavior<ResizePose>[];
  pointSnap: PointSnapBehavior<ResizePose>[];
  expandIds: (ids: string[]) => string[];
  geometry: PoseDescriptor<unknown>;
} {
  const dep = ctx.deps.resizeBehaviors as ResizeBehaviorsDep<unknown> | undefined;
  if (!dep) {
    return {
      behaviors: EMPTY_BEHAVIORS,
      pointSnap: EMPTY_POINT_SNAP,
      expandIds: IDENTITY_EXPAND,
      geometry: RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<unknown>,
    };
  }
  return {
    behaviors: dep.behaviors as unknown as ResizeBehavior<ResizePose>[],
    pointSnap: dep.pointSnap as unknown as PointSnapBehavior<ResizePose>[],
    expandIds: dep.expandIds,
    geometry: dep.geometry,
  };
}

// ---------------------------------------------------------------------------
// Default translate fallback for geometries that don't supply one.
// ---------------------------------------------------------------------------

function defaultTranslate<TPose>(p: TPose, dx: number, dy: number): TPose {
  return { ...(p as object), x: (p as { x: number }).x + dx, y: (p as { y: number }).y + dy } as TPose;
}

// ---------------------------------------------------------------------------
// Point-snap math (lifted from `useResize`).
// ---------------------------------------------------------------------------

function buildPointSnapContext<TPose extends ResizePose>(
  pose: TPose,
  rotation: number,
  anchor: ResizeAnchor,
  modifiers: ModifierState,
): PointSnapContext<TPose> {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;

  const tl = rotatePoint(pose.x, pose.y, cx, cy, rotation);
  const tr = rotatePoint(pose.x + pose.width, pose.y, cx, cy, rotation);
  const br = rotatePoint(pose.x + pose.width, pose.y + pose.height, cx, cy, rotation);
  const bl = rotatePoint(pose.x, pose.y + pose.height, cx, cy, rotation);

  let draggedCorner: { worldX: number; worldY: number } | null = null;
  let fixedCorner: { worldX: number; worldY: number } | null = null;

  if (anchor.x !== 'free' && anchor.y !== 'free') {
    const fixedPt =
      anchor.x === 'min' && anchor.y === 'min' ? tl :
      anchor.x === 'max' && anchor.y === 'min' ? tr :
      anchor.x === 'max' && anchor.y === 'max' ? br : bl;
    const draggedPt =
      anchor.x === 'min' && anchor.y === 'min' ? br :
      anchor.x === 'max' && anchor.y === 'min' ? bl :
      anchor.x === 'max' && anchor.y === 'max' ? tl : tr;
    fixedCorner = { worldX: fixedPt.x, worldY: fixedPt.y };
    draggedCorner = { worldX: draggedPt.x, worldY: draggedPt.y };
  }

  return {
    draggedCorner,
    fixedCorner,
    center: { worldX: cx, worldY: cy },
    origin: { worldX: tl.x, worldY: tl.y },
    rotation,
    anchor,
    proposed: pose,
    modifiers,
  };
}

function applyPointSnap<TPose extends ResizePose>(
  pose: TPose,
  rotation: number,
  result: PointSnapResult,
  ctx: PointSnapContext<TPose>,
): TPose {
  if (result.frame === 'center') {
    const dx = result.worldX - ctx.center.worldX;
    const dy = result.worldY - ctx.center.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }
  if (result.frame === 'origin') {
    const dx = result.worldX - ctx.origin.worldX;
    const dy = result.worldY - ctx.origin.worldY;
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  }
  const pin = result.frame === 'dragged-corner' ? ctx.fixedCorner : ctx.draggedCorner;
  if (!pin) return pose;
  const Dx = result.worldX - pin.worldX;
  const Dy = result.worldY - pin.worldY;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const localW = Dx * cos + Dy * sin;
  const localH = -Dx * sin + Dy * cos;
  const newWidth = Math.abs(localW);
  const newHeight = Math.abs(localH);
  const newCx = (pin.worldX + result.worldX) / 2;
  const newCy = (pin.worldY + result.worldY) / 2;
  return { ...pose, x: newCx - newWidth / 2, y: newCy - newHeight / 2, width: newWidth, height: newHeight };
}

// ---------------------------------------------------------------------------
// Anchor math (rotated and unrotated).
// ---------------------------------------------------------------------------

function computeProposedBounds(
  ob: ResizePose,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
  rotation: number,
): ResizePose {
  if (rotation !== 0) {
    const cs = Math.cos(-rotation);
    const sn = Math.sin(-rotation);
    const dxLocal = cs * dx - sn * dy;
    const dyLocal = sn * dx + cs * dy;
    dx = dxLocal;
    dy = dyLocal;
  }
  let nx = ob.x;
  let ny = ob.y;
  let nw = ob.width;
  let nh = ob.height;
  if (anchor.x === 'min') {
    nw = ob.width + dx;
  } else if (anchor.x === 'max') {
    nx = ob.x + dx;
    nw = ob.width - dx;
  }
  if (anchor.y === 'min') {
    nh = ob.height + dy;
  } else if (anchor.y === 'max') {
    ny = ob.y + dy;
    nh = ob.height - dy;
  }
  return { x: nx, y: ny, width: nw, height: nh };
}

function computeUnionBounds(bounds: ResizePose[]): ResizePose {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of bounds) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface ResizeScratch {
  /** Ids the gesture writes to. For group expansion this is the leaf set;
   *  for the single-id path it's the original selection. */
  writeIds: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Start poses keyed by write id. */
  startPoses: Map<NodeId, unknown>;
  /** Shared origin bounds (union for group/multi-select, own bounds for
   *  single). Used as the `src` rect for `geometry.remapBounds`. */
  originBounds: ResizePose;
  anchor: ResizeAnchor;
  startWorld: { x: number; y: number };
  /** Rotation captured at gesture start (from `geometry.getRotation?`). */
  originRotation: number;
  /** World-space position of the diagonally opposite corner at start. Used
   *  for the rotated-resize fixed-corner pin correction. */
  fixedWorld: { x: number; y: number };
  /** In-flight preview poses buffered during drag. */
  previews: Map<NodeId, unknown>;
  geometry: PoseDescriptor<unknown>;
  behaviors: ResizeBehavior<ResizePose>[];
  pointSnap: PointSnapBehavior<ResizePose>[];
  /** Gesture context handed to behaviors. Reused across move/end. */
  gestureCtx: GestureContext<unknown>;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `resize` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 * Reads optional `resizeBehaviors` dep when present.
 * Requires `InvocationCtx.drag.affordance` with a `handle:*` kind.
 */
export const resizeAction: Action & { requires: string[] } = {
  id: 'resize',
  label: 'Resize',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      const affordance = ctx.drag?.affordance;
      const anchor = affordance?.anchor;
      if (!anchor) return {};

      const { behaviors, pointSnap, expandIds, geometry } = resolveDeps(ctx);

      // Group expansion. When the starting selection is a single id but
      // `expandIds` returns a different set, we're in the group path:
      // every leaf is written, and origin bounds is the union AABB.
      // When `expandIds` returns the same list (identity default or no-op),
      // we write the selected ids directly.
      const expanded = expandIds(ids as unknown as string[]);
      if (expanded.length === 0) return {};

      const isGroupPath =
        ids.length === 1 && (expanded.length !== 1 || expanded[0] !== (ids[0] as string));
      const writeIds = (isGroupPath ? expanded : (ids as unknown as string[])) as NodeId[];

      // Capture start poses + per-leaf bounds.
      const startPoses = new Map<NodeId, unknown>();
      const leafBounds: ResizePose[] = [];
      for (const id of writeIds) {
        const node = scene.get(id);
        if (!node) continue;
        startPoses.set(id, node.pose);
        leafBounds.push(geometry.getBounds(node.pose));
      }
      if (startPoses.size === 0) return {};

      const originBounds = leafBounds.length === 1
        ? leafBounds[0]
        : computeUnionBounds(leafBounds);

      // Rotation captured only for the single-write-id path; group-resize
      // takes the AABB-frame (unrotated) path even if leaves have rotation
      // (matches `useResize` behavior).
      const originPose = !isGroupPath && writeIds.length === 1
        ? startPoses.get(writeIds[0])
        : (originBounds as unknown);
      const originRotation = !isGroupPath
        ? (geometry.getRotation?.(originPose) ?? 0)
        : 0;

      const fixedLocal = fixedCornerOf(originBounds, anchor);
      const fixedWorld = originRotation === 0
        ? fixedLocal
        : rotatePoint(
            fixedLocal.x, fixedLocal.y,
            originBounds.x + originBounds.width / 2,
            originBounds.y + originBounds.height / 2,
            originRotation,
          );

      const startWorld = { x: ctx.drag?.start.x ?? 0, y: ctx.drag?.start.y ?? 0 };

      // Minimal GestureContext for behaviors. `draggedIds` matches the
      // legacy hook: the starting id (not the expanded leaf set).
      const gestureCtx: GestureContext<unknown> = {
        draggedIds: ids as unknown as string[],
        origin: new Map<string, unknown>([[ids[0] as string, originPose]]),
        current: new Map<string, unknown>([[ids[0] as string, originPose]]),
        snap: null,
        modifiers: { ...ctx.modifiers },
        pointer: { worldX: startWorld.x, worldY: startWorld.y, clientX: 0, clientY: 0 },
        // `adapter` is unused by the kit's behaviors; cast to satisfy the type.
        adapter: undefined as unknown as GestureContext<unknown>['adapter'],
        scratch: {},
      };

      // Fire behavior onStart hooks (parity with `useResize`).
      const ctxAsRect = gestureCtx as unknown as GestureContext<ResizePose>;
      for (const b of behaviors) b.onStart?.(ctxAsRect);

      const scratch: ResizeScratch = {
        writeIds,
        scene,
        startPoses,
        originBounds,
        anchor,
        startWorld,
        originRotation,
        fixedWorld,
        previews: new Map<NodeId, unknown>(),
        geometry,
        behaviors,
        pointSnap,
        gestureCtx,
      };

      return {
        onMove(mctx: InvocationCtx): void {
          if (!mctx.drag) return;
          const dx = mctx.drag.current.x - scratch.startWorld.x;
          const dy = mctx.drag.current.y - scratch.startWorld.y;

          // Refresh modifiers + pointer on the gesture ctx for behaviors.
          scratch.gestureCtx.modifiers = { ...mctx.modifiers };
          scratch.gestureCtx.pointer = {
            worldX: mctx.drag.current.x,
            worldY: mctx.drag.current.y,
            clientX: 0,
            clientY: 0,
          };

          let proposedBounds = computeProposedBounds(
            scratch.originBounds,
            scratch.anchor,
            dx,
            dy,
            scratch.originRotation,
          );

          // Behaviors run in bounds-space.
          const behaviorCtx = scratch.gestureCtx as unknown as GestureContext<ResizePose>;
          for (const b of scratch.behaviors) {
            const r = b.onMove?.(behaviorCtx, {
              pose: proposedBounds,
              anchor: scratch.anchor,
            });
            if (!r) continue;
            if (r.pose !== undefined) {
              proposedBounds = {
                x: r.pose.x, y: r.pose.y, width: r.pose.width, height: r.pose.height,
              };
            }
          }

          // Project bounds → pose. For the group path, each leaf is remapped
          // from its own startPose; for single, from the start pose directly.
          const computePose = (id: NodeId): unknown => {
            const sp = scratch.startPoses.get(id);
            if (sp === undefined) return undefined;
            return scratch.geometry.remapBounds(sp, scratch.originBounds, proposedBounds);
          };

          // Single-id path: apply rotation correction + point-snap, then
          // store. Group path: rotation correction + point-snap don't apply
          // (group resize is AABB-frame).
          scratch.previews.clear();

          if (!isGroupPath && scratch.writeIds.length === 1) {
            const id = scratch.writeIds[0];
            let proposedPose = computePose(id);
            if (proposedPose === undefined) return;

            if (scratch.originRotation !== 0) {
              const newCenterX = proposedBounds.x + proposedBounds.width / 2;
              const newCenterY = proposedBounds.y + proposedBounds.height / 2;
              const newFixedLocal = fixedCornerOf(proposedBounds, scratch.anchor);
              const newFixedWorld = rotatePoint(
                newFixedLocal.x, newFixedLocal.y,
                newCenterX, newCenterY,
                scratch.originRotation,
              );
              const correctionX = scratch.fixedWorld.x - newFixedWorld.x;
              const correctionY = scratch.fixedWorld.y - newFixedWorld.y;
              const translate = scratch.geometry.translate ?? defaultTranslate;
              proposedPose = translate(proposedPose, correctionX, correctionY);
            }

            if (scratch.pointSnap.length > 0) {
              const rotation = scratch.originRotation;
              const poseAsRect = proposedPose as ResizePose;
              const psCtx = buildPointSnapContext(
                poseAsRect,
                rotation,
                scratch.anchor,
                scratch.gestureCtx.modifiers,
              );
              for (const beh of scratch.pointSnap) {
                const result = beh.onMove(psCtx);
                if (result) {
                  proposedPose = applyPointSnap(poseAsRect, rotation, result, psCtx) as unknown;
                  break;
                }
              }
            }

            scratch.previews.set(id, proposedPose);
            scratch.gestureCtx.current = new Map<string, unknown>([[id as string, proposedPose]]);
          } else {
            // Group / multi path: remap each leaf and store.
            for (const id of scratch.writeIds) {
              const next = computePose(id);
              if (next === undefined) continue;
              scratch.previews.set(id, next);
            }
          }
        },

        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }

          // Allow behavior onEnd to abort (return null) or override (return
          // ops). For dispatcher-path simplicity we honor null (abort) but
          // ignore ops overrides — the kit's standard behaviors only ever
          // return null/undefined. Document if a future behavior needs op
          // injection.
          for (const b of scratch.behaviors) {
            const r = b.onEnd?.(scratch.gestureCtx as unknown as GestureContext<ResizePose>);
            if (r === null) {
              scratch.previews.clear();
              return;
            }
            // r === undefined or ops[] — ignore ops and proceed with the
            // standard commit path.
          }

          if (scratch.previews.size === 0) return;
          scratch.scene.batch('Resize', () => {
            for (const id of scratch.writeIds) {
              const next = scratch.previews.get(id);
              if (next === undefined) continue;
              scratch.scene.setPose(id, next);
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
