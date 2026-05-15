import { useCallback, useEffect, useRef } from 'react';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { dispatchApplyBatch } from 'core/applyOps';
import type { NodeId } from 'core/scene/types';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../../gestures/resize/geometry';
import type { ResizePose } from '../../gestures/types';
import { useActionsRegistry } from '../registry';
import { defaultAlignActions } from '../defaults/align';

/** Edge or center the selection should align to within the selection's union AABB. */
export type AlignEdge = 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';

/** Adapter for `useAlign`. */
export interface AlignAdapter<TPose> {
  getSelection(): NodeId[];
  getPose(id: NodeId): TPose;
  applyOps?(ops: Op[], label?: string): void;
}

/** Options for `useAlign`. */
export interface UseAlignOptions<TPose> {
  /** Projection between `TPose` and bounds. Defaults to `RECT_POSE_DESCRIPTOR`
   *  for `{x,y,width,height}` poses. Pass `pathPoseDescriptor` for `Path`
   *  poses so polygon coords translate correctly. */
  geometry?: PoseDescriptor<TPose>;
  /** Label passed to applyOps. Default 'Align'. */
  label?: string;
  /** Auto-register the six default align actions into a surrounding
   *  `<ActionsProvider>`. Default `true`. Pass `false` to skip registration
   *  (e.g. you're calling `align()` imperatively from your own UI). */
  enableKeyboard?: boolean;
}

/** Return shape of `useAlign`. */
export interface UseAlignReturn {
  /** Imperative trigger. No-op when fewer than 2 items selected. */
  align(edge: AlignEdge): void;
}

function unionBounds(rs: ResizePose[]): ResizePose {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Compute the (dx, dy) translation that moves AABB `b` so that the requested
 *  `edge`/center matches the corresponding feature of the union AABB `u`. */
export function alignDeltaFor(b: ResizePose, u: ResizePose, edge: AlignEdge): { dx: number; dy: number } {
  switch (edge) {
    case 'left':     return { dx: u.x - b.x, dy: 0 };
    case 'right':    return { dx: (u.x + u.width) - (b.x + b.width), dy: 0 };
    case 'top':      return { dx: 0, dy: u.y - b.y };
    case 'bottom':   return { dx: 0, dy: (u.y + u.height) - (b.y + b.height) };
    case 'center-x': return { dx: (u.x + u.width / 2) - (b.x + b.width / 2), dy: 0 };
    case 'center-y': return { dx: 0, dy: (u.y + u.height / 2) - (b.y + b.height / 2) };
  }
}

/** Translate `pose` by `(dx, dy)` using `geometry.translate` if available,
 *  otherwise via `remapBounds` with a translated `dst` rect. */
export function translatePoseViaDescriptor<TPose>(
  pose: TPose,
  dx: number,
  dy: number,
  geometry: PoseDescriptor<TPose>,
): TPose {
  if (geometry.translate) return geometry.translate(pose, dx, dy);
  const src = geometry.getBounds(pose);
  const dst = { x: src.x + dx, y: src.y + dy, width: src.width, height: src.height };
  return geometry.remapBounds(pose, src, dst);
}

/** Align the current multi-selection to a shared edge or center of the
 *  selection's union AABB. No-op when fewer than 2 items selected.
 *  Single batch — one undo step. */
export function useAlign<TPose>(
  adapter: AlignAdapter<TPose>,
  options: UseAlignOptions<TPose> = {},
): UseAlignReturn {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const optsRef = useRef(options);
  optsRef.current = options;

  const align = useCallback((edge: AlignEdge): void => {
    const a = adapterRef.current;
    const o = optsRef.current;
    const sel = a.getSelection();
    if (sel.length < 2) return;
    const geom =
      o.geometry ??
      (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>);
    const poses = sel.map((id) => a.getPose(id));
    const bounds = poses.map((p) => geom.getBounds(p));
    const union = unionBounds(bounds);
    const ops: Op[] = [];
    for (let i = 0; i < sel.length; i++) {
      const { dx, dy } = alignDeltaFor(bounds[i], union, edge);
      if (dx === 0 && dy === 0) continue;
      const from = poses[i];
      const to = translatePoseViaDescriptor(from, dx, dy, geom);
      ops.push(createTransformOp<TPose>({ id: sel[i], from, to }));
    }
    if (ops.length === 0) return;
    dispatchApplyBatch(a, ops, o.label ?? 'Align');
  }, []);

  // Auto-register the six default align actions when an ActionsProvider is in
  // scope and `enableKeyboard` is true (default). Deps read from refs so
  // prop changes flow through without churn.
  const reg = useActionsRegistry();
  const enableKeyboard = options.enableKeyboard ?? true;
  useEffect(() => {
    if (!reg || !enableKeyboard) return;
    const actions = defaultAlignActions<TPose>({
      getSelection: () => adapterRef.current.getSelection(),
      getPose: (id) => adapterRef.current.getPose(id),
      geometry:
        optsRef.current.geometry ??
        (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>),
      applyOps: (ops, label) =>
        dispatchApplyBatch(adapterRef.current, ops, label ?? optsRef.current.label ?? 'Align'),
    });
    const unregs = actions.map((act) => reg.register(act));
    return () => { for (const u of unregs) u(); };
  }, [reg, enableKeyboard]);

  return { align };
}
