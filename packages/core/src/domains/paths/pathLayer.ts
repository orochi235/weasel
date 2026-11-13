/**
 * `RenderLayer` that fills/strokes `Path` instances. Mirrors the shape of
 * `createTextLayer`: caller hands over a `getNodes()` enumerator and a
 * `getPath(node)` lookup; the layer iterates and renders. Fill and
 * stroke are looked up per node so consumers can keep the path geometry
 * separate from the visual style record (the typical scene-graph layout).
 */

import { type DrawCommand } from '@weasel-js/renderer';
import { type CommandStroke, type CommandFill, type VertexWidth } from '@weasel-js/paint';
import { subscribeToSources, type RenderLayer } from 'core/layers/render';
import { paintOverrideSources, type PaintOverrides } from 'canvas/paintOverrides';
import { type Path, countPathAnchors } from '@weasel-js/geom';
import type { TrimOverride } from '@weasel-js/animator';
import { overrideTrim } from 'canvas/trimOverrides';
import { isDev } from '@weasel-js/react';

const PLACEHOLDER_FILL: CommandFill = { paint: { color: '#ffffff' } };
const PLACEHOLDER_STROKE: CommandStroke = { paint: { color: '#ffffff' }, width: 1 };


/** Options for `createPathLayer`. Its animated paint, typically an animator,
 *  comes before `getVertexColors`, `getStrokeVertexColors` and `getStroke`'s
 *  trim; a function-form color override receives the base colors and the
 *  timestamp `now` gives. The layer repaints for a `set` or `clear` on either registry. */
export interface CreatePathLayerOptions<T> extends PaintOverrides {
  id?: string;
  label?: string;
  getNodes: () => readonly T[];
  getPath: (node: T) => Path;
  /** Per-node fill. Return `null`/`undefined` to skip filling. */
  getFill?: (node: T) => CommandFill | null | undefined;
  /** Per-node stroke. Return `null`/`undefined` to skip stroking. */
  getStroke?: (node: T) => CommandStroke | null | undefined;
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
   * Per-node stroke vertex-width array (one `VertexWidth` per anchor: a
   * width, or a `{ left, right }` pair).
   * Length must be `countPathAnchors(getPath(node))`. The tessellator
   * interpolates half-widths along each segment for tapered strokes.
   * When set and `getStroke` returns null/undefined, a 1px placeholder
   * stroke is synthesized so the per-anchor widths take effect.
   */
  getStrokeVertexWidths?: (node: T) => VertexWidth[] | null | undefined;
  /** Clock used to timestamp function-form color overrides. Defaults to
   *  `performance.now`. Override in tests. */
  now?: () => number;
}

/** `base` with the per-anchor arrays that validated, and a trim override's edges. */
function strokeWith(
  base: CommandStroke,
  vertexColors: readonly number[] | null,
  vertexWidths: VertexWidth[] | null,
  override: TrimOverride | undefined,
): CommandStroke {
  const trim = overrideTrim(base.trim, override);
  return {
    ...base,
    ...(vertexColors != null ? { vertexColors: vertexColors as number[] } : {}),
    ...(vertexWidths != null ? { vertexWidths } : {}),
    ...(trim !== undefined ? { trim } : {}),
  };
}

/** Build a `RenderLayer` that fills/strokes `Path` instances enumerated from a node list. */
export function createPathLayer<T>(opts: CreatePathLayerOptions<T>): RenderLayer<unknown> {
  const {
    id = 'paths', label = 'Paths',
    getNodes, getPath, getFill, getStroke, isHidden,
    getVertexColors, getStrokeVertexColors, getStrokeVertexWidths,
    colorOverrides, trimOverrides,
    now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  } = opts;
  const warned = new Set<string>();
  const dev = isDev();
  const sources = paintOverrideSources({ colorOverrides, trimOverrides });

  return {
    id,
    label,
    ...(sources.length > 0 ? { subscribe: subscribeToSources(sources) } : {}),
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

        const vColors = colorOverrides
          ? colorOverrides.resolve(nodeId, 'fill', baseVColors ?? undefined, tMs)
          : baseVColors;
        const strokeVColors = colorOverrides
          ? colorOverrides.resolve(nodeId, 'stroke', baseStrokeVColors ?? undefined, tMs)
          : baseStrokeVColors;

        const nodeKey = nodeId;
        const anchorCount = countPathAnchors(path);
        const expectedLen = 4 * anchorCount;

        let useVColors: readonly number[] | null = null;
        if (vColors != null) {
          if (vColors.length === expectedLen) {
            useVColors = vColors;
          } else if (dev) {
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
          } else if (dev) {
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
        const fill: CommandFill | undefined =
          fillFromHook != null ? fillFromHook
          : (useVColors != null ? PLACEHOLDER_FILL : undefined);

        let useStrokeVWidths: VertexWidth[] | null = null;
        if (strokeVWidths != null) {
          if (strokeVWidths.length === anchorCount) {
            useStrokeVWidths = strokeVWidths;
          } else if (dev) {
            const key = `${id}:${nodeKey}:strokeWidths`;
            if (!warned.has(key)) {
              warned.add(key);
              console.warn(
                `[createPathLayer ${id}] node ${nodeKey}: stroke vertexWidths length ${strokeVWidths.length}, expected ${anchorCount}; dropping`,
              );
            }
          }
        }

        const baseStroke: CommandStroke | undefined =
          strokeFromHook != null ? strokeFromHook
          : (useStrokeVColors != null || useStrokeVWidths != null ? PLACEHOLDER_STROKE : undefined);

        const stroke = baseStroke && strokeWith(baseStroke, useStrokeVColors, useStrokeVWidths, trimOverrides?.resolve(nodeId));

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
