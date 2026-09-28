import type { NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import type { PoseDescriptor } from './resize/geometry';
import { visualBoundsViaDescriptor } from './resize/geometry';
import type { PoseFrame } from './poseFrame';

/**
 * @experimental
 * A world-space place a selection transform lines up against — what align
 * aligns to, what flip mirrors about — other than the selection itself:
 *
 * - `'pointer'` — where the pointer is: the click's world point when a click
 *   invoked the action, otherwise the latest position in the `pointer` dep.
 * - `{ x, y, width?, height? }` — a world point, or a world rect when it has
 *   extent.
 * - `{ node }` — that node's visual bounds (a key object; it does not move).
 */
export type SpatialReference =
  | 'pointer'
  | { x: number; y: number; width?: number; height?: number }
  | { node: NodeId };

/** @experimental Where `resolveSpatialReference` reads a reference's inputs. */
export interface SpatialReferenceSources {
  /** The pointer's world position, or `null` when it is over no canvas. */
  pointer(): { x: number; y: number } | null;
  /** A node's world visual bounds, or `null` when it is not in the scene. */
  nodeBounds(id: NodeId): Bounds | null;
}

/**
 * @experimental
 * The world bounds `ref` names — a point comes back as a zero-size rect — or
 * `null` when it names nothing right now (no pointer, a missing node, a
 * malformed value).
 */
export function resolveSpatialReference(
  ref: SpatialReference | unknown,
  src: SpatialReferenceSources,
): Bounds | null {
  if (ref === 'pointer') {
    const p = src.pointer();
    return p ? { x: p.x, y: p.y, width: 0, height: 0 } : null;
  }
  if (typeof ref !== 'object' || ref === null) return null;
  if ('node' in ref) return src.nodeBounds((ref as { node: NodeId }).node);
  const r = ref as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  if (typeof r.x !== 'number' || typeof r.y !== 'number') return null;
  return {
    x: r.x,
    y: r.y,
    width: typeof r.width === 'number' ? r.width : 0,
    height: typeof r.height === 'number' ? r.height : 0,
  };
}

/** The sources an immediate action resolves a reference from. A click's
 *  `worldX`/`worldY` params outrank the `pointer` dep. */
export function actionReferenceSources(
  params: Record<string, unknown> | undefined,
  pointer: PointerContextValue | undefined,
  scene: Scene<unknown, string, unknown>,
  frame: PoseFrame<unknown>,
  geom: PoseDescriptor<unknown>,
): SpatialReferenceSources {
  return {
    pointer: () => {
      if (typeof params?.worldX === 'number' && typeof params.worldY === 'number') {
        return { x: params.worldX, y: params.worldY };
      }
      const p = pointer?.get();
      return p ? { x: p.worldX, y: p.worldY } : null;
    },
    nodeBounds: (id) => (scene.get(id) === undefined
      ? null
      : visualBoundsViaDescriptor(frame.world(id), geom)),
  };
}
