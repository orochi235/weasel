/**
 * `RenderLayer` that fills/strokes `Path` instances. Mirrors the shape of
 * `createTextLayer`: caller hands over a `getNodes()` enumerator and a
 * `getPath(node)` lookup; the layer iterates and renders. Paint and
 * stroke are looked up per node so consumers can keep the path geometry
 * separate from the visual style record (the typical scene-graph layout).
 */

import { type DrawCommand, viewToMat3 } from '../../renderer';
import { type Paint, type Stroke } from '../../core/paint-types';
import type { RenderLayer } from '../../core/layers/render';
import type { Path } from './types';

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
}

/** Build a `RenderLayer` that fills/strokes `Path` instances enumerated from a node list. */
export function createPathLayer<T>(opts: CreatePathLayerOpts<T>): RenderLayer<unknown> {
  const { id = 'paths', label = 'Paths', getNodes, getPath, getFill, getStroke, isHidden } = opts;
  return {
    id,
    label,
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      for (const node of getNodes()) {
        if (isHidden?.(node)) continue;
        const path = getPath(node);
        const fill = getFill?.(node);
        const stroke = getStroke?.(node);
        if (fill == null && stroke == null) continue;
        children.push({
          kind: 'path',
          path,
          ...(fill != null ? { fill } : {}),
          ...(stroke != null ? { stroke } : {}),
        });
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
    },
  };
}
