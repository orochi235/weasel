/**
 * The paint a draw command takes: `Paint` and `Stroke` narrowed to what a
 * renderer can draw as it stands. A node's own paint may name its box
 * (`units: 'bounds'`) or a tile by kind; a command has neither a node nor a
 * rasterizer, so both are resolved before one is built.
 */

import type { Paint, PaintUnits, Stroke } from './paint';
import type { TileKind } from './patternPaint';

/** The spaces a draw command's paint can name. `'bounds'` is not one: it means
 *  a node's box, and a command has no node. */
export type CommandPaintUnits = Exclude<PaintUnits, 'bounds'>;

type InCommandUnits<F> = F extends { units?: PaintUnits }
  ? Omit<F, 'units'> & { units?: CommandPaintUnits }
  : F;

/** A `Paint` placed in a frame a command can name. Its pattern may still
 *  be a tile kind. */
export type PosedPaint = InCommandUnits<Paint>;

/** A `Paint` a renderer can draw as it stands: no paint is in `'bounds'`
 *  units, and a pattern is a registered `texture` rather than a tile kind. */
export type CommandPaint = Exclude<PosedPaint, { kind: TileKind }>;

/** The solid member of `Paint`: a color and an opacity. */
export type SolidPaint = Extract<Paint, { kind?: 'solid' }>;

/** Whether a paint is the solid member. A tile paint carries a `color` too, so
 *  the presence of one does not answer this. */
export function isSolidPaint(paint: Paint | null | undefined): paint is SolidPaint {
  return paint != null && (paint.kind === undefined || paint.kind === 'solid');
}

/** A `Stroke` whose paint is a {@link CommandPaint}. */
export type CommandStroke = Omit<Stroke, 'paint'> & { paint?: CommandPaint };
