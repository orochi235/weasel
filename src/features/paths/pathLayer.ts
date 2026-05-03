/**
 * `RenderLayer` that fills/strokes `Path` instances. Mirrors the shape of
 * `createTextLayer`: caller hands over a `getNodes()` enumerator and a
 * `getPath(node)` lookup; the layer iterates and renders. Paint and
 * stroke are looked up per node so consumers can keep the path geometry
 * separate from the visual style record (the typical scene-graph layout).
 */

import { applyPaint, applyStroke, type Paint, type Stroke } from '../../core/paint';
import type { RenderLayer } from '../layers/render';
import { traceToContext } from './canvas';
import { boundsOfPath } from './bounds';
import type { Path } from './types';

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

export function createPathLayer<T>(opts: CreatePathLayerOpts<T>): RenderLayer<unknown> {
  const { id = 'paths', label = 'Paths', getNodes, getPath, getFill, getStroke, isHidden } = opts;
  return {
    id,
    label,
    draw: (ctx) => {
      for (const node of getNodes()) {
        if (isHidden?.(node)) continue;
        const path = getPath(node);
        const fill = getFill?.(node);
        const stroke = getStroke?.(node);
        if (fill == null && stroke == null) continue;
        traceToContext(ctx, path);
        if (fill != null) {
          // Anchor fills (patterns/gradients eventually) at the path's bounds origin.
          const b = boundsOfPath(path);
          applyPaint(ctx, fill, { x: b.x, y: b.y });
          if (path.kind === 'polygon' && path.fillRule === 'evenodd') {
            ctx.fill('evenodd');
          } else {
            ctx.fill();
          }
        }
        if (stroke != null) {
          applyStroke(ctx, stroke, { x: 0, y: 0 });
          ctx.stroke();
        }
      }
    },
  };
}
