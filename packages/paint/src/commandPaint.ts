/**
 * The paint a draw command takes: `Paint` and `Stroke` narrowed to what a
 * renderer can draw as it stands. A node's own paint may name its box
 * (`units: 'bounds'`) or a tile by spec; a command has neither a node nor a
 * rasterizer, so both are resolved before one is built.
 */

import type { Paint, PaintUnits, Stroke } from './paint';
import type { TextureHandle } from './texture';

/** The spaces a draw command's paint can name. `'bounds'` is not one: it means
 *  a node's box, and a command has no node. */
export type CommandPaintUnits = Exclude<PaintUnits, 'bounds'>;

type InCommandUnits<F> = F extends { units?: PaintUnits }
  ? Omit<F, 'units'> & { units?: CommandPaintUnits }
  : F;

type WithPatternHandle<F> = F extends { kind: 'pattern' }
  ? Omit<F, 'pattern'> & { pattern: TextureHandle }
  : F;

/** A `Paint` placed in a frame a command can name. Its pattern may still
 *  be a tile spec. */
export type PosedFill = InCommandUnits<Paint>;

/** A `Paint` a renderer can draw as it stands: no paint is in `'bounds'`
 *  units, and a pattern names a registered texture rather than a tile spec. */
export type CommandFill = WithPatternHandle<PosedFill>;

/** The solid member of `Paint`: a color and an opacity. */
export type SolidFill = Extract<Paint, { color: string }>;

/** A `Stroke` whose paint is a {@link CommandFill}. */
export type CommandStroke = Omit<Stroke, 'paint'> & { paint?: CommandFill };
