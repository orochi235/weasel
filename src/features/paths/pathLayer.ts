/**
 * `RenderLayer` that fills/strokes `Path` instances. Mirrors the shape of
 * `createTextLayer`: caller hands over a `getNodes()` enumerator and a
 * `getPath(node)` lookup; the layer iterates and renders. Paint and
 * stroke are looked up per node so consumers can keep the path geometry
 * separate from the visual style record (the typical scene-graph layout).
 */

import { type DrawCommand, viewToMat3 } from '../../renderer';
import { type Paint, type Stroke } from 'core/paint-types';
import type { RenderLayer } from 'core/layers/render';
import type { Path } from './types';
import { countPathAnchors } from './anchors';

const PLACEHOLDER_FILL: Paint = { color: '#ffffff' };
const PLACEHOLDER_STROKE: Stroke = { paint: { color: '#ffffff' }, width: 1 };

/** Options for `createPathLayer`. */
export interface CreatePathLayerOpts<T> {
  id?: string;
  label?: string;
  getNodes: () => readonly T[];
  getPath: (node: T) => Path;
  /** Per-node fill paint. Return `null`/`undefined` to skip filling. */
  getFill?: (node: T) => Paint | null | undefined;
  /** Per-node stroke. Return `null`/`undefined` to skip stroking. */
  getStroke?: (node: T) => Stroke | null | undefined;
  /** Optional per-node hide hook (e.g., suppress while editing). */
  isHidden?: (node: T) => boolean;
  /**
   * Per-node fill vertex-color array, flat RGBA-per-path-anchor.
   * Length must be `4 × countPathAnchors(getPath(node))`. When set and
   * `getFill` returns null/undefined, a white placeholder fill is
   * synthesized so the renderer's per-vertex shader path activates.
   */
  getVertexColors?: (node: T) => number[] | null | undefined;
  /**
   * Per-node stroke vertex-color array, flat RGBA-per-path-anchor.
   * Length must be `4 × countPathAnchors(getPath(node))`. When set and
   * `getStroke` returns null/undefined, a white 1px placeholder stroke
   * is synthesized.
   */
  getStrokeVertexColors?: (node: T) => number[] | null | undefined;
}

/** Build a `RenderLayer` that fills/strokes `Path` instances enumerated from a node list. */
export function createPathLayer<T>(opts: CreatePathLayerOpts<T>): RenderLayer<unknown> {
  const {
    id = 'paths', label = 'Paths',
    getNodes, getPath, getFill, getStroke, isHidden,
    getVertexColors, getStrokeVertexColors,
  } = opts;
  const warned = new Set<string>();
  const isDev = typeof import.meta !== 'undefined'
    && (import.meta as any).env
    && (import.meta as any).env.DEV;

  return {
    id,
    label,
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      for (const node of getNodes()) {
        if (isHidden?.(node)) continue;
        const path = getPath(node);
        const fillFromHook = getFill?.(node);
        const strokeFromHook = getStroke?.(node);
        const vColors = getVertexColors?.(node);
        const strokeVColors = getStrokeVertexColors?.(node);

        const nodeKey = (node as { id?: string }).id ?? String(children.length);
        const expectedLen = 4 * countPathAnchors(path);

        let useVColors: number[] | null = null;
        if (vColors != null) {
          if (vColors.length === expectedLen) {
            useVColors = vColors;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:fill`;
            if (!warned.has(key)) {
              warned.add(key);
              // eslint-disable-next-line no-console
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: fill vertexColors length ${vColors.length}, expected ${expectedLen}; dropping`,
              );
            }
          }
        }

        let useStrokeVColors: number[] | null = null;
        if (strokeVColors != null) {
          if (strokeVColors.length === expectedLen) {
            useStrokeVColors = strokeVColors;
          } else if (isDev) {
            const key = `${id}:${nodeKey}:stroke`;
            if (!warned.has(key)) {
              warned.add(key);
              // eslint-disable-next-line no-console
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: stroke vertexColors length ${strokeVColors.length}, expected ${expectedLen}; dropping`,
              );
            }
          }
        }

        // Synthesize placeholder whenever the hook was provided and returned a
        // non-null value — even if the array was dropped for length mismatch.
        // This keeps the path visible in the dev-error case.
        const fill: Paint | undefined =
          fillFromHook != null ? fillFromHook
          : (vColors != null ? PLACEHOLDER_FILL : undefined);

        const baseStroke: Stroke | undefined =
          strokeFromHook != null ? strokeFromHook
          : (strokeVColors != null ? PLACEHOLDER_STROKE : undefined);

        const stroke: Stroke | undefined =
          baseStroke != null && useStrokeVColors != null
            ? { ...baseStroke, vertexColors: useStrokeVColors }
            : baseStroke;

        if (fill == null && stroke == null) continue;

        children.push({
          kind: 'path',
          path,
          ...(fill != null ? { fill } : {}),
          ...(stroke != null ? { stroke } : {}),
          ...(useVColors != null ? { vertexColors: useVColors } : {}),
        });
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
    },
  };
}
