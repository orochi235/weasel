/**
 * What each selected node gives a Boolean operation: its path, its glyph
 * outlines, or the region its ink covers once a stroke is counted.
 */
import type { Path } from '@weasel-js/geom';
import { pathUnion } from '@weasel-js/geom/booleans';
import { strokeToPath } from '@weasel-js/stroke';
import { textToPath, textToPathsByPaint } from '@weasel-js/text';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import type { NodeId } from 'core/scene/types';
import type { PaintedPath } from '../outlines/replaceWithPaths';
import type { BooleansAdapter } from './booleans';

/**
 * What a stroked operand gives a Boolean operation.
 *
 * - `'ignore'`: its path, as though it had no stroke.
 * - `'unfilled'`: the region its stroke covers when it has no fill, as a line
 *   or an open pencil stroke has none; its path when it is filled.
 * - `'include'`: what it paints — its fill and its stroke together, or the
 *   stroke alone when it has no fill.
 *
 * Any mode but `'ignore'` needs {@link BooleansAdapter.getPaint}.
 */
export type BooleanStrokes = 'ignore' | 'unfilled' | 'include';

/** Options for `applyBooleanOp`. */
export interface BooleanOpOptions {
  /** Default `'ignore'`. */
  strokes?: BooleanStrokes;
  /** The view scale a `{ px }` stroke width resolves against. Default 1. */
  scale?: number;
}

/** @internal */
export interface BooleanOperand {
  path: Path;
  /** Set when a stroke went into `path`: what a result standing in for this
   *  operand wears, the stroke being part of its shape now. */
  paint?: PathPaint;
}

function inkOf(source: PaintedPath, strokes: BooleanStrokes, scale: number | undefined): BooleanOperand {
  const { path, fill } = source;
  const { stroke } = source;
  const strokePaint = stroke?.paint;
  if (!stroke || strokePaint == null) return { path };
  if (strokes === 'ignore' || (strokes === 'unfilled' && fill !== null)) return { path };
  const ribbon = strokeToPath(path, stroke, { scale });
  if (ribbon.commands.length === 0) return { path };
  return { path: fill !== null ? pathUnion(path, ribbon) : ribbon, paint: { fill: fill ?? strokePaint } };
}

/**
 * The operand behind `id`, or `undefined` for a node that is not one: a group,
 * blank text, anything the adapter has neither a path nor text for. Throws
 * `TextOutlinesError` for text whose face has no outlines.
 */
export function resolveOperand(
  adapter: BooleansAdapter,
  id: NodeId,
  { strokes = 'ignore', scale }: BooleanOpOptions,
): BooleanOperand | undefined {
  const path = adapter.getWorldPath(id);
  if (path) {
    const paint = strokes === 'ignore' ? undefined : adapter.getPaint?.(id);
    return paint ? inkOf({ path, ...paint }, strokes, scale) : { path };
  }
  const text = adapter.getTextSource?.(id);
  if (!text) return undefined;
  if (strokes === 'ignore') {
    const glyphs = textToPath(text.data, text.pose);
    return glyphs.commands.length > 0 ? { path: glyphs } : undefined;
  }
  const inks = textToPathsByPaint(text.data, text.pose).map((p) => inkOf(p, strokes, scale));
  if (inks.length === 0) return undefined;
  const paint = inks.find((ink) => ink.paint)?.paint;
  const whole = inks.length === 1 ? inks[0]!.path : pathUnion(...inks.map((ink) => ink.path));
  return paint ? { path: whole, paint } : { path: whole };
}
