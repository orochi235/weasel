import { useCallback, useEffect, useRef } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseProjection } from '../resize/geometry';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry } from '../registry';
import { defaultFlipActions } from '../defaults/flip';

/** Axis for `useFlip`. `'x'` mirrors horizontally (left↔right); `'y'` mirrors vertically (top↔bottom). */
export type FlipAxis = 'x' | 'y';

/** How a multi-selection flip chooses its pivot.
 *
 *  - `'each'` — every pose mirrors about its own AABB; spatial layout of the
 *    selection is unchanged, individual items are reflected in place.
 *  - `'union'` — every pose mirrors about the selection's union AABB; items
 *    swap sides as well as reflect, matching Illustrator/Figma defaults.
 *
 *  Single-selection flips produce identical results in either mode. */
export type FlipPivot = 'each' | 'union';

/** Adapter for `useFlip`. */
export interface FlipAdapter<TPose> {
  getSelection(): NodeId[];
  getPose(id: NodeId): TPose;
  applyOps?(ops: Op[], label?: string): void;
}

/** Options for `useFlip`. */
export interface UseFlipOptions<TPose> {
  /** Projection between `TPose` and bounds. Defaults to `RECT_POSE_DESCRIPTOR`
   *  for `{x,y,width,height}` poses. Pass `pathPoseDescriptor` for `Path`
   *  poses so polygon coords reflect correctly. */
  geometry?: PoseProjection<TPose>;
  /** Multi-selection pivot. Default `'each'` (per-item own AABB). */
  pivot?: FlipPivot;
  /** Auto-bind Shift+H / Shift+V on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyOps. Default 'Flip'. */
  label?: string;
}

/** Return shape of `useFlip`. */
export interface UseFlipReturn {
  /** Imperative trigger. `'x'` is horizontal (mirror left/right). */
  flip(axis: FlipAxis): void;
  flipHorizontal(): void;
  flipVertical(): void;
}

/** Reflect `pose` across the centerline of `pivotBounds` along `axis`, using
 *  `geometry` to read bounds and remap. The pose's own AABB is read once to
 *  compute the reflected destination rect; coords inside the pose are then
 *  remapped through the affine that takes its own bounds → reflected dst.
 *
 *  Why: `remapBounds` with a negative-extent `dst` rect is the kit's existing
 *  affine-projection primitive. For path/polygon poses it reflects every
 *  coord; for rect-shaped poses it produces a negative width/height that we
 *  fold back into x/y so the persisted pose stays canonical. */
export function flipPoseAboutBounds<TPose>(
  pose: TPose,
  axis: FlipAxis,
  geometry: PoseProjection<TPose>,
  pivotBounds: { x: number; y: number; width: number; height: number },
): TPose {
  const src = geometry.getBounds(pose);
  const cxPivot = pivotBounds.x + pivotBounds.width / 2;
  const cyPivot = pivotBounds.y + pivotBounds.height / 2;
  // Reflect [src.x, src.x+src.width] across cxPivot using the kit's negative-extent
  // convention: with width < 0, dst occupies [dst.x + dst.width, dst.x]. The
  // reflected segment is [2*cx - (src.x+src.width), 2*cx - src.x], so dst.x is
  // the larger end (2*cx - src.x) and dst.width = -src.width.
  const dst = axis === 'x'
    ? { x: 2 * cxPivot - src.x, y: src.y, width: -src.width, height: src.height }
    : { x: src.x, y: 2 * cyPivot - src.y, width: src.width, height: -src.height };
  const next = geometry.remapBounds(pose, src, dst);
  return normalizeNegativeExtent(next);
}

/** Reflect `pose` across the centerline of its own AABB along `axis`. Thin
 *  wrapper over {@link flipPoseAboutBounds} with `pivotBounds = own bounds`. */
export function flipPoseViaDescriptor<TPose>(
  pose: TPose,
  axis: FlipAxis,
  geometry: PoseProjection<TPose>,
): TPose {
  return flipPoseAboutBounds(pose, axis, geometry, geometry.getBounds(pose));
}

function unionAabb(rs: { x: number; y: number; width: number; height: number }[]): {
  x: number; y: number; width: number; height: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function normalizeNegativeExtent<TPose>(pose: TPose): TPose {
  const p = pose as unknown as { x?: number; y?: number; width?: number; height?: number };
  let mutated = false;
  let nx = p.x;
  let ny = p.y;
  let nw = p.width;
  let nh = p.height;
  if (typeof nw === 'number' && nw < 0 && typeof nx === 'number') {
    nx = nx + nw;
    nw = -nw;
    mutated = true;
  }
  if (typeof nh === 'number' && nh < 0 && typeof ny === 'number') {
    ny = ny + nh;
    nh = -nh;
    mutated = true;
  }
  if (!mutated) return pose;
  return { ...(pose as object), x: nx, y: ny, width: nw, height: nh } as TPose;
}

/** Flip / mirror the current selection across each item's own AABB. Binds
 *  Shift+H (horizontal) and Shift+V (vertical) by default. */
export function useFlip<TPose>(
  adapter: FlipAdapter<TPose>,
  options: UseFlipOptions<TPose> = {},
): UseFlipReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const flip = useCallback((axis: FlipAxis): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length === 0) return;
    const geom =
      o.geometry ??
      (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>);
    const pivot = o.pivot ?? 'each';
    const poses = sel.map((id) => a.getPose(id));
    const unionPivot = pivot === 'union' ? unionAabb(poses.map((p) => geom.getBounds(p))) : null;
    const ops: Op[] = sel.map((id, i) => {
      const from = poses[i];
      const to = unionPivot
        ? flipPoseAboutBounds(from, axis, geom, unionPivot)
        : flipPoseViaDescriptor(from, axis, geom);
      return createTransformOp<TPose>({ id, from, to });
    });
    dispatchApplyBatch(a, ops, o.label ?? 'Flip');
  }, []);

  const flipHorizontal = useCallback(() => flip('x'), [flip]);
  const flipVertical = useCallback(() => flip('y'), [flip]);

  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;

  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const o = optsRef.current;
    const actions = defaultFlipActions<TPose>({
      getSelection: () => adapterRef.current.getSelection(),
      getPose: (id) => adapterRef.current.getPose(id),
      geometry:
        o.geometry ??
        (RECT_POSE_DESCRIPTOR as unknown as PoseProjection<TPose>),
      pivot: () => optsRef.current.pivot ?? 'each',
      applyOps: (ops, label) =>
        dispatchApplyBatch(adapterRef.current, ops, label ?? 'Flip'),
    });
    const unregs = actions.map((act) => reg.register(act));
    return () => { for (const u of unregs) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg, enableKeyboard]);

  useKeybinding(
    { key: ['h', 'H'], shift: true, enabled: enableKeyboard && reg == null },
    () => flipHorizontal(),
  );
  useKeybinding(
    { key: ['v', 'V'], shift: true, enabled: enableKeyboard && reg == null },
    () => flipVertical(),
  );

  return { flip, flipHorizontal, flipVertical };
}
