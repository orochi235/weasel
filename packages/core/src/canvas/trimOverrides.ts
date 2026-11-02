/**
 * The render walk's half of animated stroke trims: handing a node's live trim
 * override to its painter. The overrides live in an animator's
 * `TrimOverrideRegistry`; picking never reads them.
 */
import type { TrimOverride, TrimOverrideRegistry } from '@weasel-js/animator';
import type { StrokeTrim } from '@weasel-js/paint';
import type { SceneViewDrawOne } from './NodeShape';

/**
 * `base` with `override`'s edges in place of its own: each edge the override
 * sets becomes that fraction, read by `base`'s `pace`, and an edge it leaves
 * out stays as `base` gives it, an absolute measure included. With no base,
 * the override alone, at the default pace.
 */
export function overrideTrim(
  base: StrokeTrim | undefined,
  override: TrimOverride | undefined,
): StrokeTrim | undefined {
  if (override === undefined || (override.start === undefined && override.end === undefined)) return base;
  return {
    ...base,
    ...(override.start !== undefined ? { start: override.start } : {}),
    ...(override.end !== undefined ? { end: override.end } : {}),
  };
}

/**
 * Wrap a `drawOne` so a node with a live trim override reaches its painter
 * with {@link NodePaintCtx.trim}. Both scene walks wrap here, and
 * `createPathLayer` resolves through the same `TrimOverrideRegistry.resolve`.
 *
 * A node nothing overrides passes the caller's `ctx` through untouched, so
 * the common case allocates nothing.
 */
export function withTrimOverrides<TData, TLayer extends string, TPose>(
  registry: TrimOverrideRegistry,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  return (node, pose, view, ctx) => {
    if (!registry.has(node.id)) return drawOne(node, pose, view, ctx);
    const override = registry.resolve(node.id);
    return drawOne(node, pose, view, { ...ctx, trim: (base) => overrideTrim(base, override) });
  };
}
