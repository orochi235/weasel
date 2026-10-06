import type { LoupeMode, LoupePoint } from '@weasel-js/loupe';
import type { ReactNode } from 'react';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';
import type { LoupeSource } from './sourceLens';

/** What a DOM loupe's `render` is handed: the camera to draw the content
 *  through again. */
export interface LoupeRenderArgs {
  /** The trial's own camera composed with the magnification, about the aimed
   *  point — so drawing the same content through it magnifies in place. */
  view: ViewTransform;
  /** The magnification on its own, for whatever must not scale with the
   *  camera. */
  factor: number;
  mode: LoupeMode;
  /** The size of the viewport `view` is written for: the trial's content well,
   *  not the lens. The lens shows a circle cut out of it. */
  size: ViewportSize;
}

/** The outline of a lens. On a box that is not square, `'circle'` is an ellipse. */
export type LoupeShape = 'circle' | 'square';

/** Where a host puts the lens for one aim, in the host's own CSS px. */
export interface LoupePlacement {
  /** Where the lens is drawn: the middle of its box. */
  center: LoupePoint;
  /** The host point the lens shows at its middle. Omitted, `center`; it
   *  differs when a lens is moved to stay on the host but keeps showing what
   *  it was placed over. */
  shows?: LoupePoint;
  width: number;
  height: number;
  /** The magnification for this placement. Omitted, the wheel's. */
  factor?: number;
}

/** What `place` is asked with. */
export interface LoupePlaceArgs {
  aim: LoupePoint;
  factor: number;
}

/**
 * How a lens magnifies.
 *
 * With no `render`, the lens re-draws the canvas stack's layers through a
 * zoomed camera, so it stays sharp at any factor. Over DOM content, `render`
 * draws it instead: given a camera, draw me again. With a `source`, it
 * enlarges the pixels of that canvas — any canvas, labkit's or not.
 */
export interface LoupeOptions {
  render?: (args: LoupeRenderArgs) => ReactNode;
  /**
   * A canvas to read pixels from instead of the canvas stack: a
   * `CanvasSource` from `createCanvasSource`, a canvas, a context on one, or
   * a function returning one once it exists. 2D, WebGL and WebGL2 all work.
   * Without `render` the lens enlarges its pixels, so the mode is `'pixel'`;
   * with `render`, `render` draws the lens and the source answers
   * `onColorChange`.
   *
   * A WebGL canvas made without `preserveDrawingBuffer` is blank to anyone
   * reading it after the frame that drew it. Make its source with
   * `createCanvasSource(gl)` and call `source.capture()` right after each
   * draw; a canvas that draws on demand also passes `requestRedraw`.
   */
  source?: LoupeSource;
  /** Opening magnification, clamped to the bounds below. Default 6. */
  factor?: number;
  /** What the wheel clamps to. Defaults 2 and 32. */
  minFactor?: number;
  maxFactor?: number;
  /** `'vector'` (default) re-renders the content magnified; `'pixel'` blows up
   *  the pixels the instrument presented. A `render` loupe is always vector —
   *  DOM has no framebuffer to enlarge — and a `source` loupe always pixel. */
  mode?: LoupeMode;
  /** Lens diameter in CSS px. Default 200. */
  diameter?: number;
  /** Default `'circle'`. */
  shape?: LoupeShape;
  /**
   * Puts the lens somewhere other than a `diameter` box on the aim: the lens is
   * drawn with the returned box centered on `center`, and shows what is around
   * `shows` (or `center`) magnified by the returned `factor`, or by the wheel's when it
   * returns none. `factor` in the argument is always the wheel's, so a host
   * lowering it to fit something in keeps the wheel as the ceiling. Returning
   * `null` keeps the default. It is
   * called while the lens renders, so a host whose content moves under a still
   * pointer re-renders the lens to re-place it. The color under the aim is
   * still the one `onColorChange` reports.
   */
  place?: (at: LoupePlaceArgs) => LoupePlacement | null;
  /** Held for a momentary peek while the loupe is off. Default `'Alt'`; `null`
   *  turns hold-to-peek off. Matched against `KeyboardEvent.key`. */
  peekKey?: string | null;
  /** Called with the color under the aim, wherever the surface can say. The
   *  canvas painter and a `source` read it back; a DOM loupe with no `source`
   *  has no pixels to sample. */
  onColorChange?: (hex: string) => void;
}

/** {@link LoupeOptions} with every default filled in. */
export interface ResolvedLoupe {
  render?: (args: LoupeRenderArgs) => ReactNode;
  source?: LoupeSource;
  onColorChange?: (hex: string) => void;
  factor: number;
  minFactor: number;
  maxFactor: number;
  mode: LoupeMode;
  diameter: number;
  shape: LoupeShape;
  place?: (at: LoupePlaceArgs) => LoupePlacement | null;
  peekKey: string | null;
}

/** What `resolveLoupe` fills in for anything a declaration leaves unset. */
export const LOUPE_DEFAULTS = {
  factor: 6,
  minFactor: 2,
  maxFactor: 32,
  mode: 'vector',
  diameter: 200,
  shape: 'circle',
  peekKey: 'Alt',
} as const satisfies Omit<ResolvedLoupe, 'render' | 'source' | 'onColorChange' | 'place'>;

/** `options` with every default filled in and `factor` clamped to
 *  `[minFactor, maxFactor]`. A loupe with its own `render` is always `'vector'`,
 *  and one with only a `source` always `'pixel'`. */
export function resolveLoupe(options: LoupeOptions = {}): ResolvedLoupe {
  const minFactor = options.minFactor ?? LOUPE_DEFAULTS.minFactor;
  const maxFactor = options.maxFactor ?? LOUPE_DEFAULTS.maxFactor;
  return {
    render: options.render,
    source: options.source,
    onColorChange: options.onColorChange,
    minFactor,
    maxFactor,
    factor: Math.min(maxFactor, Math.max(minFactor, options.factor ?? LOUPE_DEFAULTS.factor)),
    diameter: options.diameter ?? LOUPE_DEFAULTS.diameter,
    shape: options.shape ?? LOUPE_DEFAULTS.shape,
    place: options.place,
    peekKey: options.peekKey === undefined ? LOUPE_DEFAULTS.peekKey : options.peekKey,
    // A DOM loupe has no framebuffer, so `pixel` would have nothing to enlarge.
    mode: options.render
      ? 'vector'
      : options.source
        ? 'pixel'
        : (options.mode ?? LOUPE_DEFAULTS.mode),
  };
}
