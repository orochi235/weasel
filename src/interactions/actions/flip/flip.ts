import { useCallback, useEffect, useRef } from 'react';
import { createTransformOp } from '../../../core/ops/transform';
import type { Op } from '../../../core/ops/types';
import { dispatchApplyBatch } from '../../../core/applyOps';
import type { NodeId } from '../../../core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../../gestures/resize/geometry';
import { useKeybinding } from '../useKeybinding';
import { useActionsRegistry } from '../registry';
import { defaultFlipActions } from '../defaults/flip';

/** Axis for `useFlip`. `'x'` mirrors horizontally (left↔right); `'y'` mirrors vertically (top↔bottom). */
export type FlipAxis = 'x' | 'y';

/** Adapter for `useFlip`. */
export interface FlipAdapter<TPose> {
  getSelection(): NodeId[];
  getPose(id: NodeId): TPose;
  applyBatch?(ops: Op[], label?: string): void;
}

/** Options for `useFlip`. */
export interface UseFlipOptions<TPose> {
  /** Projection between `TPose` and bounds. Defaults to `RECT_POSE_DESCRIPTOR`
   *  for `{x,y,width,height}` poses. Pass `pathPoseDescriptor` for `Path`
   *  poses so polygon coords reflect correctly. */
  geometry?: PoseDescriptor<TPose>;
  /** Auto-bind Shift+H / Shift+V on document. Default true. */
  enableKeyboard?: boolean;
  /** Label passed to applyBatch. Default 'Flip'. */
  label?: string;
}

/** Return shape of `useFlip`. */
export interface UseFlipReturn {
  /** Imperative trigger. `'x'` is horizontal (mirror left/right). */
  flip(axis: FlipAxis): void;
  flipHorizontal(): void;
  flipVertical(): void;
}

/** Reflect `pose` across the centerline of its own AABB along `axis`, using
 *  `geometry` to read bounds and remap. Each pose is mirrored about its own
 *  bounds — multi-selection flips do NOT pivot on a shared union AABB.
 *
 *  Why: `remapBounds` with a negative-extent `dst` rect is the kit's existing
 *  affine-projection primitive. For path/polygon poses it correctly reflects
 *  every coord. For rect-shaped poses it produces a negative width/height
 *  that we fold back into x/y so the persisted pose stays canonical. */
export function flipPoseViaDescriptor<TPose>(
  pose: TPose,
  axis: FlipAxis,
  geometry: PoseDescriptor<TPose>,
): TPose {
  const src = geometry.getBounds(pose);
  const dst = axis === 'x'
    ? { x: src.x + src.width, y: src.y, width: -src.width, height: src.height }
    : { x: src.x, y: src.y + src.height, width: src.width, height: -src.height };
  const next = geometry.remapBounds(pose, src, dst);
  return normalizeNegativeExtent(next);
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
      (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
    const ops: Op[] = sel.map((id) => {
      const from = a.getPose(id);
      const to = flipPoseViaDescriptor(from, axis, geom);
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
    const a = adapterRef.current;
    const o = optsRef.current;
    const actions = defaultFlipActions<TPose>({
      getSelection: () => a.getSelection(),
      getPose: (id) => a.getPose(id),
      geometry:
        o.geometry ??
        (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>),
      applyBatch: (ops, label) => dispatchApplyBatch(a, ops, label ?? 'Flip'),
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
