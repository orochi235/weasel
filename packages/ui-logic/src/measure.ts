import type { Rect } from '@weasel-js/geom';

/** The sizes a box may take, in CSS px. `Infinity` for a max leaves that axis free. */
export interface Constraints {
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
}

/** No bound on either axis: a box at its own size. */
export const UNBOUNDED: Constraints = { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };

/** Exactly `width` by `height`: a box placed into a fixed rectangle. */
export function exactly(width: number, height: number): Constraints {
  return { minWidth: width, maxWidth: width, minHeight: height, maxHeight: height };
}

/** Exactly `width` wide and as tall as the box likes: a box filling its column. */
export function fixedWidth(width: number): Constraints {
  return { minWidth: width, maxWidth: width, minHeight: 0, maxHeight: Infinity };
}

/** `size` clamped to `[min, max]`. A max below its min yields the min, as CSS does. */
export function clampTo(size: number, min: number, max: number): number {
  return Math.max(min, Math.min(size, max));
}

/** The font a run of text is measured in. `family` is a CSS font-family list; a target that draws with
 *  fonts of its own maps it onto one. */
export interface FontSpec {
  readonly family?: string;
  readonly size: number;
  readonly weight?: number;
}

/** A run of text's advance width and the ascent and descent its line is set with, in px. */
export interface TextExtent {
  readonly width: number;
  readonly ascent: number;
  readonly descent: number;
}

/**
 * What measuring reads from where the component is drawn: its theme's tokens and its text metrics. A DOM element's
 * computed style answers it, and so does a HUD's resolved theme and font atlas, which is what lets one `measure`
 * serve both.
 */
export interface MeasureEnv {
  /** A token's value (`'28px'`, `'500'`), or undefined where nothing sets it. */
  token(name: string): string | undefined;
  text(text: string, font: FontSpec): TextExtent;
}

/** A px token as a number: `name`, else `fallback`. Throws where neither is a px length, since silently reading
 *  0 collapses whatever the token sizes. */
export function envPx(env: MeasureEnv, name: string, fallback?: number | string): number {
  const raw = env.token(name)?.trim();
  if (raw) {
    const m = /^(-?\d*\.?\d+)px$/.exec(raw);
    if (m) return Number(m[1]);
  }
  if (typeof fallback === 'number') return fallback;
  if (typeof fallback === 'string') return envPx(env, fallback);
  throw new Error(`envPx: ${name} is not a px length (${raw ?? 'unset'})`);
}

/** A unitless numeric token, else `fallback`. */
export function envNumber(env: MeasureEnv, name: string, fallback: number): number {
  const n = Number.parseFloat(env.token(name) ?? '');
  return Number.isFinite(n) ? n : fallback;
}

/** A box's size, its first baseline, and where its parts sit inside it. */
export interface Measured<L> {
  readonly width: number;
  readonly height: number;
  /** From the box's top to its first line of text's alphabetic baseline, as CSS `align-items: baseline` reads
   *  it; the bottom edge for a box with no text. */
  readonly baseline: number;
  /** Where each part sits, relative to the box's top left. Its shape is the component's own. */
  readonly layout: L;
}

/**
 * The baseline of a line of text `lineHeight` tall centered in a box `boxHeight` tall, from the box's top: CSS's
 * half-leading model, the line's ascent and descent centered inside its line height.
 */
export function centeredBaseline(boxHeight: number, lineHeight: number, extent: TextExtent): number {
  const top = (boxHeight - lineHeight) / 2;
  return top + (lineHeight - (extent.ascent + extent.descent)) / 2 + extent.ascent;
}

/** `r` moved by `(dx, dy)`. */
export function offsetRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, width: r.width, height: r.height };
}

/**
 * The one contract a control implements on every target it is drawn on: measure, then draw.
 *
 * - `measure` is shared code. It reads only `state` and the target's {@link MeasureEnv}, so a DOM component and a HUD
 *   widget measuring the same state in the same theme answer the same box, and a host can lay either out before it
 *   exists.
 * - `draw` is per target, and its output is the target's own: a React element for the DOM, draw commands for a
 *   HUD. It is not handed the measured box. A target that positions by coordinates (a HUD) calls `measure` itself
 *   with its bounds as {@link exactly}; a DOM target lays its parts out with CSS from the same tokens `measure`
 *   reads, which a measure-to-DOM test holds it to. A paint sink shared by both was the alternative, and it would
 *   make the DOM rebuild by hand what its stylesheet already says.
 *
 * Both halves read which parts `state` shows from one function the component exports (`buttonParts`,
 * `listMode`), so neither target can show a part the other lacks.
 */
export interface HeadlessComponent<S, L, T, O> {
  measure(state: S, constraints: Constraints, env: MeasureEnv): Measured<L>;
  draw(state: S, target: T): O;
}
