import {
  DEFAULT_HANDLE_SIZE,
  ROTATED_POSE_DESCRIPTOR,
  RECT_POSE_DESCRIPTOR,
  rotatePoint,
  fixedCornerOf,
} from '@weasel-js/core';
import type { PoseDescriptor, RotatedPose, ResizeAnchor, Bounds } from '@weasel-js/core';

export type PanelId = 'green' | 'orange' | 'purple' | 'teal';

export interface Rect extends RotatedPose {
  id: string;
  color: string;
}

export const W = 320, H = 240, HANDLE = DEFAULT_HANDLE_SIZE;

export const INITIAL_GREEN: Rect = { id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#7fb069' };
export const INITIAL_ORANGE: Rect = { ...INITIAL_GREEN, color: '#d4a574' };
export const INITIAL_PURPLE: Rect = { ...INITIAL_GREEN, color: '#a48bd4' };
export const INITIAL_TEAL: Rect = { ...INITIAL_GREEN, color: '#5b9aa0' };


/** Subverted descriptor: pose carries rotation, but `getRotation` lies and
 *  returns 0 → kit's resize math takes the unrotated path; drag delta is
 *  applied in world frame instead of being projected by `R(-θ)`. Visible
 *  failure: rect distorts as world-axis scale fights the rotation. */
export const NO_PROJECTION_DESCRIPTOR: PoseDescriptor<Rect> = {
  ...(RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<Rect>),
  getRotation: () => 0,
};

/** Subverted descriptor: rotation is read normally (so projection runs), but
 *  `translate` is a no-op. Visible failure: rect scales correctly in local
 *  frame, but the post-remap fixed-corner correction never lands, so the
 *  AABB center stays anchored and the perceived "fixed corner" drifts. */
export const NO_CORRECTION_DESCRIPTOR: PoseDescriptor<Rect> = {
  ...(ROTATED_POSE_DESCRIPTOR as unknown as PoseDescriptor<Rect>),
  translate: (p) => p,
};

/** Subverted descriptor: projection + correction both run, but `remapBounds`
 *  couples the rotation property to the AABB diagonal angle, which changes
 *  whenever the aspect ratio does. Visible failure: as you resize, the rect
 *  rotates — the rotation pivot effectively follows the diagonal. The correct
 *  behavior keeps rotation orthogonal to bounds so the gesture only changes
 *  shape. */
export const COUPLED_ROTATION_DESCRIPTOR: PoseDescriptor<Rect> = {
  ...(ROTATED_POSE_DESCRIPTOR as unknown as PoseDescriptor<Rect>),
  remapBounds: (origin: Rect, originBounds: Bounds, newBounds: Bounds): Rect => {
    const base = (ROTATED_POSE_DESCRIPTOR as unknown as PoseDescriptor<Rect>)
      .remapBounds(origin, originBounds, newBounds);
    const originDiag = Math.atan2(originBounds.height, originBounds.width);
    const newDiag = Math.atan2(newBounds.height, newBounds.width);
    return { ...base, rotation: base.rotation + (newDiag - originDiag) };
  },
};

// ─── Resize math (mirrors `src/interactions/actions/defaults/resize.ts`) ───

/** World-frame `(dx, dy)` projected by `R(-rotation)`, then anchor-relative
 *  bounds math applied in the local frame. Matches `computeProposedBounds` in
 *  the kit's `resizeAction` invoker. */
export function computeProposedBounds(
  ob: Bounds,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
  rotation: number,
): Bounds {
  if (rotation !== 0) {
    const cs = Math.cos(-rotation);
    const sn = Math.sin(-rotation);
    const dxL = cs * dx - sn * dy;
    const dyL = sn * dx + cs * dy;
    dx = dxL;
    dy = dyL;
  }
  let nx = ob.x, ny = ob.y, nw = ob.width, nh = ob.height;
  if (anchor.x === 'min') nw = ob.width + dx;
  else if (anchor.x === 'max') { nx = ob.x + dx; nw = ob.width - dx; }
  if (anchor.y === 'min') nh = ob.height + dy;
  else if (anchor.y === 'max') { ny = ob.y + dy; nh = ob.height - dy; }
  return { x: nx, y: ny, width: nw, height: nh };
}

/** World-space fixed corner of a rotated rect for the given anchor. */
export function fixedCornerWorld(pose: Rect, anchor: ResizeAnchor): { x: number; y: number } {
  const local = fixedCornerOf(pose, anchor);
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  return rotatePoint(local.x, local.y, cx, cy, pose.rotation);
}

/** Apply one frame of resize to `startPose` through `geometry`. Mirrors the
 *  kit's resizeAction invoker `onMove` path for the single-id case. */
export function runResize(
  geometry: PoseDescriptor<Rect>,
  startPose: Rect,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
): Rect {
  const originBounds = geometry.getBounds(startPose);
  const rotation = geometry.getRotation?.(startPose) ?? 0;
  const proposedBounds = computeProposedBounds(originBounds, anchor, dx, dy, rotation);
  let proposed = geometry.remapBounds(startPose, originBounds, proposedBounds);
  if (rotation !== 0) {
    const startFixedLocal = fixedCornerOf(originBounds, anchor);
    const startFixedWorld = rotatePoint(
      startFixedLocal.x, startFixedLocal.y,
      originBounds.x + originBounds.width / 2,
      originBounds.y + originBounds.height / 2,
      rotation,
    );
    const newFixedLocal = fixedCornerOf(proposedBounds, anchor);
    const newFixedWorld = rotatePoint(
      newFixedLocal.x, newFixedLocal.y,
      proposedBounds.x + proposedBounds.width / 2,
      proposedBounds.y + proposedBounds.height / 2,
      rotation,
    );
    const cxCorrection = startFixedWorld.x - newFixedWorld.x;
    const cyCorrection = startFixedWorld.y - newFixedWorld.y;
    const translate = geometry.translate
      ?? ((p: Rect, tx: number, ty: number): Rect => ({ ...p, x: p.x + tx, y: p.y + ty }));
    proposed = translate(proposed, cxCorrection, cyCorrection);
  }
  return proposed;
}

// ─── Tiny presentational helpers ───

export function median3(x: number, y: number, z: number): number {
  if (x > y) [x, y] = [y, x];
  if (y > z) [y, z] = [z, y];
  if (x > y) [x, y] = [y, x];
  return y;
}

export function medianPose(a: Rect, b: Rect, c: Rect): Rect {
  return {
    id: a.id,
    color: a.color,
    x: median3(a.x, b.x, c.x),
    y: median3(a.y, b.y, c.y),
    width: median3(a.width, b.width, c.width),
    height: median3(a.height, b.height, c.height),
    rotation: median3(a.rotation, b.rotation, c.rotation),
  };
}

export const PROJECTIONS: Record<PanelId, PoseDescriptor<Rect>> = {
  green: ROTATED_POSE_DESCRIPTOR as unknown as PoseDescriptor<Rect>,
  orange: NO_PROJECTION_DESCRIPTOR,
  purple: NO_CORRECTION_DESCRIPTOR,
  teal: COUPLED_ROTATION_DESCRIPTOR,
};

export const PANEL_IDS: PanelId[] = ['green', 'orange', 'purple', 'teal'];
