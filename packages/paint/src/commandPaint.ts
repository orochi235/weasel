/**
 * The paint a draw command takes: `FillStyle` and `Stroke` narrowed to what a
 * renderer can draw as it stands. A node's own paint may name its box
 * (`units: 'bounds'`) or a tile by spec; a command has neither a node nor a
 * rasterizer, so both are resolved before one is built.
 */

import type { FillStyle, GradientUnits, Stroke } from './paint';
import type { TextureHandle } from './texture';

/** The spaces a draw command's paint can name. `'bounds'` is not one: it means
 *  a node's box, and a command has no node. */
export type CommandPaintUnits = Exclude<GradientUnits, 'bounds'>;

/** `F` with `'bounds'` units ruled out, where `F` is a paint that has units. */
export type InCommandUnits<F> = F extends { units?: GradientUnits }
  ? Omit<F, 'units'> & { units?: CommandPaintUnits }
  : F;

/** `F` with its pattern a registered texture, where `F` is a pattern fill. */
export type WithPatternHandle<F> = F extends { fill: 'pattern' }
  ? Omit<F, 'pattern'> & { pattern: TextureHandle }
  : F;

/** A `FillStyle` placed in a frame a command can name. Its pattern may still
 *  be a tile spec. */
export type PosedFill = InCommandUnits<FillStyle>;

/** A `FillStyle` a renderer can draw as it stands: no paint is in `'bounds'`
 *  units, and a pattern names a registered texture rather than a tile spec. */
export type CommandFill = WithPatternHandle<PosedFill>;

/** The solid member of `FillStyle`: a color and an opacity. */
export type SolidFill = Extract<FillStyle, { color: string }>;

/** A `Stroke` whose paint is a {@link CommandFill}. */
export type CommandStroke = Omit<Stroke, 'paint'> & { paint?: CommandFill };
