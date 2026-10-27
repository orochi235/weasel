/**
 * The paint a draw command takes: `Paint` and `Stroke` narrowed to what a
 * renderer can draw as it stands. A node's own paint may name its box
 * (`units: 'bounds'`), a tile by kind, or an image by `src`; a command has no
 * node, rasterizer or decoder, so all of these are resolved before one is built.
 */

import type { Fill, Paint, PaintUnits, Stroke } from './paint';
import type { ResolvablePatternKind } from './patternPaint';

/** The spaces a draw command's paint can name. `'bounds'` is not one: it means
 *  a node's box, and a command has no node. */
export type CommandPaintUnits = Exclude<PaintUnits, 'bounds'>;

/** `F` with `'bounds'` units ruled out, where `F` is a paint that has units. */
export type InCommandUnits<F> = F extends { units?: PaintUnits }
  ? Omit<F, 'units'> & { units?: CommandPaintUnits }
  : F;

/** A `Paint` placed in a frame a command can name. Its pattern may still
 *  be a tile kind or an image. */
export type PosedPaint = InCommandUnits<Paint>;

/** A `Paint` a renderer can draw as it stands: no paint is in `'bounds'`
 *  units, and a pattern is a registered `texture` rather than a tile kind or
 *  an image. */
export type CommandPaint = Exclude<PosedPaint, { kind: ResolvablePatternKind }>;

/** The solid member of `Paint`: a color and an opacity. */
export type SolidPaint = Extract<Paint, { kind?: 'solid' }>;

/** Whether a paint is the solid member. A tile paint carries a `color` too, so
 *  the presence of one does not answer this. */
export function isSolidPaint(paint: Paint | null | undefined): paint is SolidPaint {
  return paint != null && (paint.kind === undefined || paint.kind === 'solid');
}

/** A `Fill` whose paint is a {@link CommandPaint}. */
export interface CommandFill extends Omit<Fill, 'paint'> {
  paint?: CommandPaint;
}

/** A `Stroke` whose paint is a {@link CommandPaint}. */
export type CommandStroke = Omit<Stroke, 'paint'> & { paint?: CommandPaint };
