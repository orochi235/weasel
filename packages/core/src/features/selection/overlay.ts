/**
 * Selection overlay primitives — render layers for drawing selection
 * outlines and corner resize handles in world space.
 *
 * Three pieces:
 *   - `composeSelectionPose` resolves the live pose for a selected id by
 *     consulting the move overlay first, then the resize overlay, then the
 *     stored pose. When `getChildren`/`isContainer` are supplied and the id
 *     resolves to a container, the returned pose is the union AABB of all
 *     transitive leaf poses (with the same precedence rules applied per leaf).
 *   - `createSelectionOutlineLayer` draws the outline rect for each selected
 *     id (container ids resolve to a union AABB via `getChildren`/`isContainer`).
 *   - `createSelectionHandlesLayer` draws resize-handle rects (default 4
 *     corners) for each selected id, with the same container-resolution rules.
 *
 * `createSelectionOverlayLayer` is a thin convenience that returns a single
 * `RenderLayer` whose draw runs the outline pass then the handles pass.
 *
 * **Pose shape:** TPose is generic; callers must supply `getBounds(pose)`
 * to project any pose into the AABB the renderer needs. For rect-shaped
 * poses (`{x, y, width, height}`) pass the identity. For `Path` poses pass
 * `boundsOfPath`. Container ids reduce via `unionBounds` over the projected
 * AABBs.
 */

import type { DrawCommand } from '../../renderer';
import { mat3, type Mat3 } from '../../renderer';
import type { NodeId } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import { unionBounds } from '../groups/unionBounds';
import { alignedStrokeRect, type FillStyle, type Stroke } from 'core/paint-types';
import { resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import {
  rotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from 'interactions/actions/rotate/handle';
import { rotatePoint } from 'interactions/actions/rotate/geometry';
import { poseRotationOf } from 'features/paths/poseRotation';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { ChromeState } from 'core/selection/chromeState';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { meanScale } from 'core/viewport/meanScale';
import { PATH_L, PATH_M, type PolygonPath } from '../paths/types';
import { HANDLE_BASE_PX } from 'core/device/targets';

/** Project world AABB into screen-space AABB using the active view. */
function projectBounds<B extends Bounds>(b: B, view: View): B {
  const t = viewToTransform(view);
  const [sx, sy] = worldToScreen(b.x, b.y, t);
  return { ...b, x: sx, y: sy, width: b.width * view.scale.x, height: b.height * view.scale.y };
}


/** Options for `composeSelectionPose`. */
export interface ComposeSelectionPoseOpts<TPose> {
  /** Move overlay; when present its `poses` map wins over everything else. */
  moveOverlay?: { poses: Map<string, TPose> } | null;
  /**
   * Resize overlay; consulted only when move overlay does not own the id.
   * For container resize, `leafPoses` (when present) maps each leaf id under
   * the container to its overlay pose. If absent the container falls back to
   * stored leaf poses (defensive — container-resize integration is in flight).
   */
  resizeOverlay?: {
    id: string;
    currentPose: TPose;
    leafPoses?: Map<string, TPose>;
  } | null;
  /** Fallback pose lookup (typically the stored/committed pose). */
  getStoredPose: (id: string) => TPose;
  /**
   * Project a pose into its AABB. Used when reducing a group of leaf poses
   * into a single union AABB. Defaults to the identity — rect-shaped poses
   * (`{x, y, width, height}`) need no override. For `Path` poses pass
   * `boundsOfPath`.
   */
  getBounds?: (pose: TPose) => Bounds;
  /**
   * Wrap an AABB back into a TPose. Called only when the resolver collapses
   * a container's leaves into a single union AABB. Defaults to the identity —
   * for `Path` poses pass `(b) => ({ kind: 'rect', ...b })`.
   */
  fromBounds?: (bounds: Bounds) => TPose;
  /** Walk a container's direct children (e.g. `scene.childrenOf`). With
   *  `isContainer`, a selected container resolves to the union AABB of its
   *  transitive leaf poses instead of its own stored pose. */
  getChildren?: (id: string) => readonly string[];
  /** True when `id` is a structural container. */
  isContainer?: (id: string) => boolean;
}

/**
 * Build a pose resolver for a selection. Precedence per id:
 * move overlay > resize overlay > stored. When `getChildren`/`isContainer`
 * are supplied and the id resolves to a container, the resolver returns the
 * union AABB of all transitive leaf poses (each leaf still subject to the
 * precedence rules). Containers with no leaves resolve to `null`.
 */
export function composeSelectionPose<TPose>(
  opts: ComposeSelectionPoseOpts<TPose>,
): (id: string) => TPose | null {
  const { moveOverlay, resizeOverlay, getStoredPose, getChildren, isContainer } = opts;
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const fromBounds = opts.fromBounds ?? ((bounds: Bounds) => bounds as unknown as TPose);

  const leavesOf = (id: string): string[] => {
    if (!getChildren || !isContainer || !isContainer(id)) return [id];
    const out: string[] = [];
    const visit = (nid: string) => {
      const kids = getChildren(nid);
      // A childless node is a leaf only if it is not itself a container. An
      // empty container contributes no bounds: this resolver exists to avoid
      // a container's own stored pose, and that pose is at its most stale
      // when there are no children left to have moved it.
      if (kids.length === 0) { if (!isContainer(nid)) out.push(nid); return; }
      for (const k of kids) visit(k);
    };
    visit(id);
    return out;
  };

  const resolveLeaf = (id: string): TPose => {
    const moved = moveOverlay?.poses.get(id);
    if (moved !== undefined) return moved;
    if (resizeOverlay && resizeOverlay.id === id) return resizeOverlay.currentPose;
    return getStoredPose(id);
  };

  return (id: string): TPose | null => {
    if (isContainer?.(id)) {
      const leaves = leavesOf(id);
      if (leaves.length === 0) return null;
      const containerResizeLeafPoses =
        resizeOverlay && resizeOverlay.id === id ? resizeOverlay.leafPoses : undefined;
      const leafBounds: Bounds[] = [];
      for (const leafId of leaves) {
        const moved = moveOverlay?.poses.get(leafId);
        if (moved !== undefined) {
          leafBounds.push(getBounds(moved));
          continue;
        }
        const overlayLeaf = containerResizeLeafPoses?.get(leafId);
        if (overlayLeaf !== undefined) {
          leafBounds.push(getBounds(overlayLeaf));
          continue;
        }
        leafBounds.push(getBounds(getStoredPose(leafId)));
      }
      const u = unionBounds(leafBounds);
      if (u === null) return null;
      return fromBounds(u);
    }
    return resolveLeaf(id);
  };
}

/**
 * Build a pose resolver that handles container ids by computing the union
 * AABB of every leaf's bounds. Non-container ids pass through directly. When
 * `getChildren`/`isContainer` are omitted, every id is treated as a leaf.
 */
function makeContainerAwareBoundsResolver<TPose>(
  getPose: (id: string) => TPose | null,
  getBounds: (pose: TPose) => Bounds,
  getChildren?: (id: string) => readonly string[],
  isContainer?: (id: string) => boolean,
): (id: string) => Bounds | null {
  if (getChildren === undefined || isContainer === undefined) {
    return (id: string) => {
      const p = getPose(id);
      return p === null ? null : getBounds(p);
    };
  }
  const leavesOf = (id: string): string[] => {
    if (!isContainer(id)) return [id];
    const out: string[] = [];
    const visit = (nid: string) => {
      const kids = getChildren(nid);
      // See `composeSelectionPose.leavesOf` — an empty container is not a leaf.
      if (kids.length === 0) { if (!isContainer(nid)) out.push(nid); return; }
      for (const k of kids) visit(k);
    };
    visit(id);
    return out;
  };
  return (id: string): Bounds | null => {
    if (!isContainer(id)) {
      const p = getPose(id);
      return p === null ? null : getBounds(p);
    }
    const leaves = leavesOf(id);
    if (leaves.length === 0) return null;
    const leafBounds: Bounds[] = [];
    for (const leafId of leaves) {
      const p = getPose(leafId);
      if (p !== null) leafBounds.push(getBounds(p));
    }
    if (leafBounds.length === 0) return null;
    return unionBounds(leafBounds);
  };
}

/** Shared options between outline and handles layers. */
interface SelectionLayerCommon<TPose> {
  getSelection: () => readonly NodeId[];
  /** Return null to skip rendering for an id (e.g. resolved pose unavailable).
   *  Takes `string` rather than `NodeId` because the container-aware bounds
   *  resolver internally walks expanded leaf ids via `getChildren`, which is
   *  generic over arbitrary string ids. NodeIds flow in fine — a NodeId is a
   *  string. */
  getPose: (id: string) => TPose | null;
  /**
   * Project a pose into its AABB. Defaults to the identity — rect-shaped
   * poses (`{x, y, width, height}`) need no override. For `Path` poses pass
   * `boundsOfPath`.
   */
  getBounds?: (pose: TPose) => Bounds;
  /** Walk a container's direct children (e.g. `scene.childrenOf`). When
   *  supplied with `isContainer`, any id that resolves to a container is
   *  rendered using the union bounds of all its transitive leaves. */
  getChildren?: (id: string) => readonly string[];
  /** True when `id` is a structural container. */
  isContainer?: (id: string) => boolean;
}

/** Options for `createSelectionOutlineLayer`. */
export interface SelectionOutlineLayerOpts<TPose> extends SelectionLayerCommon<TPose> {
  /** Outline stroke style + outset distance from the pose rect. */
  outline?: Stroke & { pad?: number };
}

/** Options for `createSelectionHandlesLayer`. */
export interface SelectionHandlesLayerOpts<TPose> extends SelectionLayerCommon<TPose> {
  /** Handle visuals. Omit for defaults. */
  handles?: {
    size?: number;
    fill?: FillStyle;
    outline?: Stroke;
  };
  /** Override handle placement. Default: 4 corners of the AABB. */
  handlesOf?: (bounds: Bounds) => { x: number; y: number }[];
  /** Render a rotation handle above the (rotated) top-center of the AABB.
   *  When `true`, uses default visuals + distance. When an object, override
   *  the world-space distance from the top edge. Defaults to `false` —
   *  consumers opt in only when wiring `useRotate`. */
  rotationHandle?:
    | boolean
    | {
        /** World-pixel distance from the top edge to the handle center. */
        distance?: number;
      };
}

/** Options for `createSelectionOverlayLayer`. */
export interface SelectionOverlayLayerOpts<TPose> extends SelectionLayerCommon<TPose> {
  outline?: Stroke & { pad?: number };
  /** Pass `false` to render outlines only. */
  handles?:
    | {
        size?: number;
        fill?: FillStyle;
        outline?: Stroke;
      }
    | false;
  handlesOf?: (bounds: Bounds) => { x: number; y: number }[];
  /** See {@link SelectionHandlesLayerOpts.rotationHandle}. */
  rotationHandle?:
    | boolean
    | {
        distance?: number;
      };
  /** Optional separate id list for the per-item outline pass. Use this in
   *  multi-selection contexts where the handle pass works against a synthetic
   *  union id (e.g. `MULTI_RESIZE_TARGET_ID`) but consumers still want to
   *  see outlines around each real member. When omitted, the outline pass
   *  uses the same `getSelection` ids as the handle pass. */
  getOutlineIds?: () => readonly NodeId[];
  /** Optional set of ids to suppress entirely — both outline and handles
   *  are skipped. Used by SceneCanvas to hide the standard selection
   *  chrome on the node currently in path-anchor edit mode, where the
   *  per-anchor chrome takes over. */
  getSuppressedIds?: () => ReadonlySet<string>;
}

const DEFAULT_OUTLINE: Required<Pick<Stroke, 'paint' | 'width'>> & { pad: number } = {
  paint: { fill: 'solid', color: '#f0e0a8' },
  width: 2,
  pad: 1,
};
const DEFAULT_HANDLE_FILL: FillStyle = { fill: 'solid', color: '#d4c4a8' };
const DEFAULT_HANDLE_OUTLINE: Stroke = {
  paint: { fill: 'solid', color: '#1a130d' },
  width: 1,
};
const DEFAULT_HANDLE_SIZE = HANDLE_BASE_PX;

function defaultHandlesOf(b: Bounds): { x: number; y: number }[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x, y: b.y + b.height },
    { x: b.x + b.width, y: b.y + b.height },
  ];
}

function resolveOutlineStroke(opts?: Stroke & { pad?: number }): {
  stroke: Stroke;
  pad: number;
} {
  if (!opts) {
    return {
      stroke: { paint: DEFAULT_OUTLINE.paint, width: DEFAULT_OUTLINE.width },
      pad: DEFAULT_OUTLINE.pad,
    };
  }
  return {
    stroke: {
      paint: opts.paint,
      width: opts.width ?? DEFAULT_OUTLINE.width,
      dash: opts.dash,
      cap: opts.cap,
      join: opts.join,
      align: opts.align,
    },
    pad: opts.pad ?? DEFAULT_OUTLINE.pad,
  };
}

interface ResolvedHandles {
  size: number;
  fill: FillStyle;
  outline: Stroke;
}

function resolveHandles(opts?: SelectionHandlesLayerOpts<unknown>['handles']): ResolvedHandles {
  return {
    size: opts?.size ?? DEFAULT_HANDLE_SIZE,
    fill: opts?.fill ?? DEFAULT_HANDLE_FILL,
    outline: opts?.outline ?? DEFAULT_HANDLE_OUTLINE,
  };
}

/**
 * GL helper: build the matrix `translate(cx, cy) * rotate(θ) * translate(-cx, -cy)`
 * used to wrap rotated outline / handle commands.
 */
function rotateAroundMat3(cx: number, cy: number, theta: number): Mat3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  // Composed in column-major (matches mat3 helpers): T(cx,cy) · R(θ) · T(-cx,-cy).
  // After expansion: a=c, b=s, c'=-s, d=c, tx=cx - c*cx + s*cy, ty=cy - s*cx - c*cy.
  const tx = cx - c * cx + s * cy;
  const ty = cy - s * cx - c * cy;
  return new Float32Array([
    c, s, 0,
    -s, c, 0,
    tx, ty, 1,
  ]) as Mat3;
}

/** GL helper: emit a closed rect path (kind:'rect'). */
function rectPathFor(x: number, y: number, width: number, height: number): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  return { kind: 'rect', x, y, width, height };
}

/** GL helper: emit an outline command for one bounds entry. */
function outlineCommandsFor(
  ids: readonly string[],
  resolveBounds: (id: string) => Bounds | null,
  stroke: Stroke,
  pad: number,
  view: View,
): DrawCommand[] {
  const out: DrawCommand[] = [];
  const align = stroke.align ?? 'center';
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  for (const id of ids) {
    const worldB = resolveBounds(id);
    if (!worldB) continue;
    const b = projectBounds(worldB, view);
    const padded = {
      x: b.x - pad,
      y: b.y - pad,
      width: b.width + pad * 2,
      height: b.height + pad * 2,
    };
    const r = alignedStrokeRect(padded, align, width);
    const cmd: DrawCommand = {
      kind: 'path',
      path: rectPathFor(r.x, r.y, r.width, r.height),
      stroke,
    };
    // Rotation gate + angle from the kit's one convention; pivot is the
    // selection center in SCREEN space (the chrome is drawn post-projection).
    const rot = poseRotationOf(worldB);
    if (!rot) {
      out.push(cmd);
    } else {
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      out.push({
        kind: 'group',
        transform: rotateAroundMat3(cx, cy, rot.rotation),
        children: [cmd],
      });
    }
  }
  return out;
}

/** GL helper: emit handle fill+stroke commands for one bounds entry. */
function handleCommandsFor(
  ids: readonly string[],
  resolveBounds: (id: string) => Bounds | null,
  handles: ResolvedHandles,
  handlesOf: (b: Bounds) => { x: number; y: number }[],
  view: View,
): DrawCommand[] {
  const out: DrawCommand[] = [];
  const half = handles.size / 2;
  const handleAlign = handles.outline.align ?? 'center';
  const handleWidth = resolveStrokeWidth(handles.outline.width ?? 1, 1);
  for (const id of ids) {
    const worldB = resolveBounds(id);
    if (!worldB) continue;
    const b = projectBounds(worldB, view);
    // Rotation gate + angle from the kit's one convention; pivot is the
    // selection center in SCREEN space (handles are placed post-projection).
    const r = poseRotationOf(worldB);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    for (const hWorld of handlesOf(worldB)) {
      const t = viewToTransform(view);
      const [hsx, hsy] = worldToScreen(hWorld.x, hWorld.y, t);
      const center = r ? rotatePoint(hsx, hsy, cx, cy, r.rotation) : { x: hsx, y: hsy };
      const baseRect = {
        x: center.x - half,
        y: center.y - half,
        width: handles.size,
        height: handles.size,
      };
      const sr = alignedStrokeRect(baseRect, handleAlign, handleWidth);
      const fillCmd: DrawCommand = {
        kind: 'path',
        path: rectPathFor(baseRect.x, baseRect.y, baseRect.width, baseRect.height),
        fill: handles.fill,
      };
      const strokeCmd: DrawCommand = {
        kind: 'path',
        path: rectPathFor(sr.x, sr.y, sr.width, sr.height),
        stroke: handles.outline,
      };
      if (!r) {
        out.push(fillCmd, strokeCmd);
      } else {
        out.push({
          kind: 'group',
          transform: rotateAroundMat3(center.x, center.y, r.rotation),
          children: [fillCmd, strokeCmd],
        });
      }
    }
  }
  return out;
}

/** GL helper: emit a curved double-headed arrow indicating bidirectional
 *  rotation. The arc opens *toward* the object (apex on top, mouth pointing
 *  down) so the affordance reads as a small "rotate" badge sitting above
 *  the rect. Two arrowheads at the arc endpoints point along the tangent,
 *  signaling that rotation goes either direction. */
function rotationHandleCommands(
  worldB: Bounds,
  handles: ResolvedHandles,
  distance: number,
  view: View,
): DrawCommand[] {
  const rotation = worldB.rotation ?? 0;
  const hWorld = rotationHandle({ ...worldB, rotation }, distance / meanScale(view.scale));
  const t = viewToTransform(view);
  const [scx, scy] = worldToScreen(hWorld.cx, hWorld.cy, t);
  const size = handles.size;
  const arcRadius = size;
  // Arc spans ~240° (from 150° to -30° measured from arc center, going
  // CCW). The arc center is the handle anchor; the arc itself bulges
  // *toward the rect* (downward, since the handle sits above the AABB).
  const ARC_HALF_ANGLE = (Math.PI * 240) / 360 / 2; // 120°
  const N_SEGS = 18;
  const arcWidth = resolveStrokeWidth(handles.outline.width ?? 1, 1) * 1.5;
  const stroke: Stroke = {
    paint: handles.fill,
    width: arcWidth,
    cap: 'round',
    join: 'round',
  };
  // Build the arc as a polyline in handle-local coords. Arc bulges *away*
  // from the rect (upward in canvas space, since the handle sits above the
  // AABB top edge): apex at -y, endpoints at +y near the rect side.
  const cmds: number[] = [PATH_M];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= N_SEGS; i++) {
    const t = i / N_SEGS;
    const angle = ARC_HALF_ANGLE - t * ARC_HALF_ANGLE * 2;
    xs.push(arcRadius * Math.sin(angle));
    ys.push(-arcRadius * Math.cos(angle));
    if (i > 0) cmds.push(PATH_L);
  }
  const arcCoords: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    arcCoords.push(xs[i], ys[i]);
  }
  const arcPath: PolygonPath = {
    kind: 'polygon',
    commands: new Uint8Array(cmds),
    coords: new Float32Array(arcCoords),
    fillRule: 'nonzero',
  };
  // Arrowheads: small filled triangles at each endpoint, pointing along
  // the tangent (away from the arc body). Tangent at endpoint = derivative
  // of (sin(angle), cos(angle)) wrt angle = (cos(angle), -sin(angle)).
  // At +ARC_HALF_ANGLE the tangent points "outward and slightly up"; at
  // -ARC_HALF_ANGLE the tangent points the other way.
  const headLen = size * 0.6;
  const headWidth = size * 0.4;
  const arrowHead = (endX: number, endY: number, tx: number, ty: number): PolygonPath => {
    // Normalize tangent.
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len;
    const uy = ty / len;
    // Perpendicular (rotate tangent 90° CCW).
    const px = -uy;
    const py = ux;
    // Triangle: tip is endX+ux*headLen, base is endX (with +/- headWidth/2 along p).
    const tipX = endX + ux * headLen;
    const tipY = endY + uy * headLen;
    const baseLeftX = endX + px * (headWidth / 2);
    const baseLeftY = endY + py * (headWidth / 2);
    const baseRightX = endX - px * (headWidth / 2);
    const baseRightY = endY - py * (headWidth / 2);
    return {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L]),
      coords: new Float32Array([tipX, tipY, baseLeftX, baseLeftY, baseRightX, baseRightY, tipX, tipY]),
      fillRule: 'nonzero',
    };
  };
  // Endpoint A (right side, angle = +ARC_HALF_ANGLE). Arc point:
  // (sin(a)·R, -cos(a)·R). Tangent (d/da) = (cos(a)·R, sin(a)·R) — points
  // outward/down at the right end. Use as "rotate further clockwise" arrow.
  const angleA = ARC_HALF_ANGLE;
  const endAX = arcRadius * Math.sin(angleA);
  const endAY = -arcRadius * Math.cos(angleA);
  const tangentAX = Math.cos(angleA);
  const tangentAY = Math.sin(angleA);
  // Endpoint B (left side, angle = -ARC_HALF_ANGLE): tangent in the
  // outward direction is the negation of the above.
  const angleB = -ARC_HALF_ANGLE;
  const endBX = arcRadius * Math.sin(angleB);
  const endBY = -arcRadius * Math.cos(angleB);
  const tangentBX = -Math.cos(angleB);
  const tangentBY = -Math.sin(angleB);
  const headA = arrowHead(endAX, endAY, tangentAX, tangentAY);
  const headB = arrowHead(endBX, endBY, tangentBX, tangentBY);
  const headFill: FillStyle = handles.fill;
  // Build transform: translate(scx, scy) [* rotate(rotation)].
  let transform = mat3.translate(mat3.identity(), scx, scy);
  if (rotation !== 0) {
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const rot = new Float32Array([c, s, 0, -s, c, 0, 0, 0, 1]) as Mat3;
    transform = mat3.multiply(transform, rot);
  }
  return [
    {
      kind: 'group',
      transform,
      children: [
        { kind: 'path', path: arcPath, stroke },
        { kind: 'path', path: headA, fill: headFill },
        { kind: 'path', path: headB, fill: headFill },
      ],
    },
  ];
}

/**
 * `RenderLayer` that draws selection outlines only. Stack alongside
 * `createSelectionHandlesLayer` (or just use `createSelectionOverlayLayer`
 * for the common case) when both passes are wanted.
 */
export function createSelectionOutlineLayer<TPose>(
  opts: SelectionOutlineLayerOpts<TPose>,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const resolveBounds = makeContainerAwareBoundsResolver(opts.getPose, getBounds, opts.getChildren, opts.isContainer);
  return {
    id: 'selection-outline',
    label: 'Selection outline',
    space: 'screen',
    draw: (_data, view) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return [];
      return outlineCommandsFor(ids, resolveBounds, stroke, pad, view);
    },
  };
}

/**
 * `RenderLayer` that draws selection handles only. Stack on top of
 * `createSelectionOutlineLayer` (handles render on top of the outline).
 */
export function createSelectionHandlesLayer<TPose>(
  opts: SelectionHandlesLayerOpts<TPose>,
): RenderLayer<unknown> {
  const handles = resolveHandles(opts.handles);
  const handlesOf = opts.handlesOf ?? defaultHandlesOf;
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const resolveBounds = makeContainerAwareBoundsResolver(opts.getPose, getBounds, opts.getChildren, opts.isContainer);
  const rotationHandleDistance = resolveRotationHandleDistance(opts.rotationHandle);
  return {
    id: 'selection-handles',
    label: 'Selection handles',
    space: 'screen',
    draw: (_data, view) => {
      const ids = opts.getSelection();
      if (ids.length === 0) return [];
      const out = handleCommandsFor(ids, resolveBounds, handles, handlesOf, view);
      if (rotationHandleDistance !== null) {
        for (const id of ids) {
          const b = resolveBounds(id);
          if (!b) continue;
          for (const cmd of rotationHandleCommands(b, handles, rotationHandleDistance, view)) {
            out.push(cmd);
          }
        }
      }
      return out;
    },
  };
}

function resolveRotationHandleDistance(
  opt: boolean | { distance?: number } | undefined,
): number | null {
  if (!opt) return null;
  if (opt === true) return DEFAULT_ROTATION_HANDLE_DISTANCE;
  return opt.distance ?? DEFAULT_ROTATION_HANDLE_DISTANCE;
}

/**
 * Convenience wrapper that draws outlines then handles in a single layer.
 * Equivalent to stacking `createSelectionOutlineLayer` and
 * `createSelectionHandlesLayer` in a layer sequence. Pass `handles: false` to
 * render outlines only.
 */
export function createSelectionOverlayLayer<TPose>(
  opts: SelectionOverlayLayerOpts<TPose>,
): RenderLayer<unknown> {
  const { stroke, pad } = resolveOutlineStroke(opts.outline);
  const handlesEnabled = opts.handles !== false;
  const handles = handlesEnabled ? resolveHandles(opts.handles || undefined) : null;
  const handlesOf = opts.handlesOf ?? defaultHandlesOf;
  const getBounds = opts.getBounds ?? ((pose: TPose) => pose as unknown as Bounds);
  const resolveBounds = makeContainerAwareBoundsResolver(opts.getPose, getBounds, opts.getChildren, opts.isContainer);
  const rotationHandleDistance = resolveRotationHandleDistance(opts.rotationHandle);

  return {
    id: 'selection-overlay',
    label: 'Selection',
    space: 'screen',
    draw: (data, view) => {
      const allIds = opts.getSelection();
      if (allIds.length === 0) return [];
      const suppressed = opts.getSuppressedIds?.();
      const ids = suppressed && suppressed.size > 0
        ? allIds.filter((id) => !suppressed.has(id as unknown as string))
        : allIds;
      if (ids.length === 0) return [];
      // Chrome-caps: gate each of the three passes (outline, resize
      // handles, rotation handle) on its canonical id. When no
      // `getIsVisible` is wired (legacy callers / tests), every pass
      // runs — preserving pre-chrome-caps behavior.
      const isVisible = asIsVisible(data);
      const showOutline = isVisible ? isVisible('selection.outline') : true;
      const showHandles = isVisible ? isVisible('selection.resize-handles') : true;
      const showRotation = isVisible ? isVisible('selection.rotation-handle') : true;

      // The synthetic multi-resize id resolves to `ChromeState.unionBounds`,
      // the single owner of the multi-selection union AABB — the same value
      // the affordance hit-tester (`affordanceAt` / `composeAffordanceLayer`)
      // reads, so painted chrome and its hit region stay in agreement. When
      // no chromeState rides the draw envelope (bare/test callers), fall
      // through to the supplied resolver so they can synthesize it via
      // `getPose`.
      const chromeState = asChromeState(data);
      const resolveTargetBounds = (id: string): Bounds | null => {
        if (id === MULTI_RESIZE_TARGET_ID && chromeState?.unionBounds != null) {
          return chromeState.unionBounds;
        }
        return resolveBounds(id);
      };

      const out: DrawCommand[] = [];
      if (showOutline) {
        const outlineIdsRaw = opts.getOutlineIds ? opts.getOutlineIds() : ids;
        const outlineIds = suppressed && suppressed.size > 0
          ? outlineIdsRaw.filter((id) => !suppressed.has(id as unknown as string))
          : outlineIdsRaw;
        for (const cmd of outlineCommandsFor(outlineIds, resolveTargetBounds, stroke, pad, view)) out.push(cmd);
      }
      if (!handles) return out;
      if (showHandles) {
        for (const cmd of handleCommandsFor(ids, resolveTargetBounds, handles, handlesOf, view)) out.push(cmd);
      }
      if (showRotation && rotationHandleDistance !== null) {
        for (const id of ids) {
          const b = resolveTargetBounds(id);
          if (!b) continue;
          for (const cmd of rotationHandleCommands(b, handles, rotationHandleDistance, view)) {
            out.push(cmd);
          }
        }
      }
      return out;
    },
  };
}

/** Pull a chrome-caps visibility predicate off the draw `data` envelope.
 *  Returns `null` when the caller passed bare data (no `getIsVisible`
 *  thunk) — the layer then renders unconditionally, matching pre-
 *  chrome-caps behavior. */
function asIsVisible(data: unknown): ((id: string) => boolean) | null {
  const maybe = data as { getIsVisible?: () => (id: string) => boolean };
  if (typeof maybe?.getIsVisible === 'function') return maybe.getIsVisible();
  return null;
}

/** Pull live `ChromeState` off the draw `data` envelope (the same channel
 *  `composeAffordanceLayer` uses). Returns `null` for bare/test callers that
 *  pass plain data with no `getChromeState` thunk — the layer then resolves
 *  the multi-union via the supplied `getPose` resolver, preserving pre-
 *  chromeState behavior. */
function asChromeState(data: unknown): ChromeState | null {
  const maybe = data as { getChromeState?: () => ChromeState };
  if (typeof maybe?.getChromeState === 'function') return maybe.getChromeState();
  return null;
}
