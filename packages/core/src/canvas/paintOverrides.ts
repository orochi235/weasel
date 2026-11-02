/**
 * The render walk's half of animated paint: handing a node's live vertex-color
 * and stroke-trim overrides to its painter. The overrides live in an animator's
 * `ColorOverrideRegistry` and `TrimOverrideRegistry`; picking never reads them.
 */
import type { ColorOverrideRegistry, TrimOverrideRegistry } from '@weasel-js/animator';
import type { RedrawSource } from 'core/layers/render';
import type { NodePaintCtx, SceneViewDrawOne } from './NodeShape';
import { overrideTrim } from './trimOverrides';

/** Animated paint to lay over a scene's nodes, typically an `animator`. */
export interface PaintOverrides {
  /** Per-anchor colors; see `NodePaintCtx.vertexColors`. */
  colorOverrides?: ColorOverrideRegistry;
  /** Stroke trims; see `NodePaintCtx.trim`. */
  trimOverrides?: TrimOverrideRegistry;
}

const clock = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Wrap a `drawOne` so a node with a live override reaches its painter with
 * {@link NodePaintCtx.vertexColors} and {@link NodePaintCtx.trim}, in one
 * context. Both scene walks wrap here; `createPathLayer` resolves through the
 * same registries' `resolve`.
 *
 * A node nothing overrides passes the caller's `ctx` through untouched, so
 * the common case allocates nothing.
 */
export function withPaintOverrides<TData, TLayer extends string, TPose>(
  overrides: PaintOverrides | undefined,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
  now: () => number = clock,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const colors = overrides?.colorOverrides;
  const trims = overrides?.trimOverrides;
  if (!colors && !trims) return drawOne;
  return (node, pose, view, ctx) => {
    const colored = colors?.has(node.id) === true;
    const trimmed = trims?.has(node.id) === true;
    if (!colored && !trimmed) return drawOne(node, pose, view, ctx);
    const painted: NodePaintCtx = { ...ctx };
    if (colored) {
      const tMs = now();
      painted.vertexColors = (channel, base) => colors!.resolve(node.id, channel, base, tMs);
    }
    if (trimmed) {
      const override = trims!.resolve(node.id);
      painted.trim = (base) => overrideTrim(base, override);
    }
    return drawOne(node, pose, view, painted);
  };
}

/** What repaints for a `set` or `clear` on `overrides`, which no animation frame announces. */
export function paintOverrideSources(overrides: PaintOverrides | undefined): RedrawSource[] {
  const sources: RedrawSource[] = [];
  if (overrides?.colorOverrides) sources.push(overrides.colorOverrides);
  if (overrides?.trimOverrides) sources.push(overrides.trimOverrides);
  return sources;
}
