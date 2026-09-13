/**
 * The render walk's half of animated vertex colors: handing a node's live
 * color overrides to its painter. The overrides live in an animator's
 * `ColorOverrideRegistry`, which `tweenVertexColors` and its siblings write.
 */
import type { ColorOverrideRegistry } from '../animation/colorRegistry';
import type { SceneViewDrawOne } from './NodeShape';

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Wrap a `drawOne` so a node with a live color override reaches its painter
 * with {@link NodePaintCtx.vertexColors}. Both scene walks wrap here, and
 * `createPathLayer` resolves through the same `ColorOverrideRegistry.resolve`.
 *
 * A node nothing overrides passes the caller's `ctx` through untouched, so
 * the common case allocates nothing.
 */
export function withColorOverrides<TData, TLayer extends string, TPose>(
  registry: ColorOverrideRegistry,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
  now: () => number = clock,
): SceneViewDrawOne<TData, TLayer, TPose> {
  return (node, pose, view, ctx) => {
    if (!registry.has(node.id)) return drawOne(node, pose, view, ctx);
    const tMs = now();
    return drawOne(node, pose, view, {
      ...ctx,
      vertexColors: (channel, base) => registry.resolve(node.id, channel, base, tMs),
    });
  };
}
