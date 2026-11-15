import type { View } from 'core/viewport/view';
import type { NodePaintCtx } from './nodeShapeTypes';
import { hasOwnShapes, nodeShapesOf } from './nodeShapeRegistry';

/** `ctx` with `scene`'s painters on it, where they could answer other than the default's. The
 *  scene's registry is read per call, so a painter installed after this was made still counts. */
export function sceneShapesCtx<C extends Pick<NodePaintCtx, 'shapes'>>(scene: object, ctx: C | undefined): C | undefined {
  if (ctx?.shapes) return ctx;
  const shapes = nodeShapesOf(scene);
  return hasOwnShapes(shapes) ? { ...ctx, shapes } as C : ctx;
}

/** `draw` — a `drawOne`, or a `paintBounds` — handed `scene`'s painters on its ctx. */
export function withSceneShapes<N, P, R, C extends Pick<NodePaintCtx, 'shapes'> = NodePaintCtx>(
  scene: object,
  draw: (node: N, pose: P, view: View, ctx?: C) => R,
): (node: N, pose: P, view: View, ctx?: C) => R {
  return (node, pose, view, ctx) => draw(node, pose, view, sceneShapesCtx(scene, ctx));
}
