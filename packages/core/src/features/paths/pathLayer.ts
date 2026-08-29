/**
 * `RenderLayer` that fills/strokes `Path` instances. Mirrors the shape of
 * `createTextLayer`: caller hands over a `getNodes()` enumerator and a
 * `getPath(node)` lookup; the layer iterates and renders. FillStyle and
 * stroke are looked up per node so consumers can keep the path geometry
 * separate from the visual style record (the typical scene-graph layout).
 */

import { type DrawCommand } from '../../renderer';
import { type FillStyle, type Stroke } from '@weasel-js/paint';
import type { RenderLayer } from 'core/layers/render';
import type { Path } from './types';
import { countPathAnchors } from './anchors';
import type { ColorOverride, ColorOverrideRegistry } from '../../animation/colorRegistry';

const PLACEHOLDER_FILL: FillStyle = { color: '#ffffff' };
const PLACEHOLDER_STROKE: Stroke = { paint: { color: '#ffffff' }, width: 1 };

function resolveOverride(
  base: readonly number[] | null | undefined,
  override: ColorOverride | undefined,
  tMs: number,
): readonly number[] | null | undefined {
  if (!override) return base;
  if (typeof override === 'function') {
    if (!base) return base;
    const result = override(base, tMs);
    if (result.length !== base.length) return base;
    return result;
  }
  return override;
}

/** Options for `createPathLayer`. */
export interface CreatePathLayerOpts<T> {
  id?: string;
  label?: string;
  getNodes: () => readonly T[];
  getPath: (node: T) => Path;
  /** Per-node fill paint. Return `null`/`undefined` to skip filling. */
  getFill?: (node: T) => FillStyle | null | undefined;
  /** Per-node stroke. Return `null`/`undefined` to skip stroking. */
  getStroke?: (node: T) => Stroke | null | undefined;
  /** Optional per-node hide hook (e.g., suppress while editing). */
  isHidden?: (node: T) => boolean;
  /**
   * Per-node fill vertex-color array, flat RGBA-per-path-anchor, in
   * 0..1 floats (same color space as `PathDrawCommand.vertexColors`).
   * Length must be `4 × countPathAnchors(getPath(node))`. When set and
   * `getFill` returns null/undefined, a white placeholder fill is
   * synthesized so the renderer's per-vertex shader path activates.
   */
  getVertexColors?: (node: T) => number[] | null | undefined;
  /**
   * Per-node stroke vertex-color array, flat RGBA-per-path-anchor, in
   * 0..1 floats (same color space as `Stroke.vertexColors`).
   * Length must be `4 × countPathAnchors(getPath(node))`. When set and
   * `getStroke` returns null/undefined, a white 1px placeholder stroke
   * is synthesized.
   */
  getStrokeVertexColors?: (node: T) => number[] | null | undefined;
  /**
   * Per-node stroke vertex-width array (one width per anchor).
   * Length must be `countPathAnchors(getPath(node))`. The tessellator
   * interpolates half-widths along each segment for tapered strokes.
   * When set and `getStroke` returns null/undefined, a 1px placeholder
   * stroke is synthesized so the per-anchor widths take effect.
   */
  getStrokeVertexWidths?: (node: T) => number[] | null | undefined;
  /**
   * Optional color override registry, typically `animator.colorOverrides`.
   * When set, the renderer consults it before falling back to
   * `getVertexColors` / `getStrokeVertexColors`. Function-form overrides
   * receive the base color array and the current animation timestamp.
   */
  colorOverrides?: ColorOverrideRegistry;
  /** Clock used to timestamp function-form color overrides. Defaults to
   *  `performance.now`. Override in tests. */
  now?: () => number;
}

/** Build a `RenderLayer` that fills/strokes `Path` instances enumerated from a node list. */
export function createPathLayer<T>(opts: CreatePathLayerOpts<T>): RenderLayer<unknown> {
  const {
    id = 'paths', label = 'Paths',
    getNodes, getPath, getFill, getStroke, isHidden,
    getVertexColors, getStrokeVertexColors, getStrokeVertexWidths,
    colorOverrides,
    now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  } = opts;
  const warned = new Set<string>();
  const isDev = typeof import.meta !== 'undefined'
    && (import.meta as unknown as { env?: { DEV?: boolean } }).env
    && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

  return {
    id,
    label,
    draw: () => {
      const children: DrawCommand[] = [];
      const nodes = getNodes();
      for (let idx = 0; idx < nodes.length; idx++) {
        const node = nodes[idx];
        if (isHidden?.(node)) continue;
        const path = getPath(node);
        const fillFromHook = getFill?.(node);
        const strokeFromHook = getStroke?.(node);
        const baseVColors = getVertexColors?.(node);
        const baseStrokeVColors = getStrokeVertexColors?.(node);
        const strokeVWidths = getStrokeVertexWidths?.(node);

        const nodeId = (node as { id?: string }).id ?? String(idx);
        const tMs = colorOverrides ? now() : 0;

        const fillOverride = colorOverrides?.get(nodeId, 'fill');
        const strokeOverride = colorOverrides?.get(nodeId, 'stroke');

        const vColors = resolveOverride(baseVColors, fillOverride, tMs);
        const strokeVColors = resolveOverride(baseStrokeVColors, strokeOverride, tMs);

        const nodeKey = nodeId;
        const anchorCount = countPathAnchors(path);
        const expectedLen = 4 * anchorCount;

        let useVColors: readonly number[] | null = null;
        if (vColors != null) {
          if (vColors.length === expectedLen) {
            useVColors = vColors;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:fill`;
            if (!warned.has(key)) {
              warned.add(key);
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: fill vertexColors length ${vColors.length}, expected ${expectedLen}; dropping`,
              );
            }
          }
        }

        let useStrokeVColors: readonly number[] | null = null;
        if (strokeVColors != null) {
          if (strokeVColors.length === expectedLen) {
            useStrokeVColors = strokeVColors;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:stroke`;
            if (!warned.has(key)) {
              warned.add(key);
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: stroke vertexColors length ${strokeVColors.length}, expected ${expectedLen}; dropping`,
              );
            }
          }
        }

        // Synthesize placeholder only when colors validate (useVColors != null),
        // not on any raw hook return. Mismatched-length arrays drop both the
        // colors and placeholder so the dev signal (console warning) isn't duplicated.
        const fill: FillStyle | undefined =
          fillFromHook != null ? fillFromHook
          : (useVColors != null ? PLACEHOLDER_FILL : undefined);

        let useStrokeVWidths: number[] | null = null;
        if (strokeVWidths != null) {
          if (strokeVWidths.length === anchorCount) {
            useStrokeVWidths = strokeVWidths;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:strokeWidths`;
            if (!warned.has(key)) {
              warned.add(key);
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: stroke vertexWidths length ${strokeVWidths.length}, expected ${anchorCount}; dropping`,
              );
            }
          }
        }

        const baseStroke: Stroke | undefined =
          strokeFromHook != null ? strokeFromHook
          : (useStrokeVColors != null || useStrokeVWidths != null ? PLACEHOLDER_STROKE : undefined);

        const stroke: Stroke | undefined =
          baseStroke != null
            ? {
                ...baseStroke,
                ...(useStrokeVColors != null ? { vertexColors: useStrokeVColors as number[] } : {}),
                ...(useStrokeVWidths != null ? { vertexWidths: useStrokeVWidths } : {}),
              }
            : baseStroke;

        if (fill == null && stroke == null) continue;

        children.push({
          kind: 'path',
          path,
          ...(fill != null ? { fill } : {}),
          ...(stroke != null ? { stroke } : {}),
          ...(useVColors != null ? { vertexColors: useVColors as number[] } : {}),
        });
      }
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}
