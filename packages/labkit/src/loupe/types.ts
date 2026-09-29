import type { LoupeMode } from '@weasel-js/loupe';
import type { ReactNode } from 'react';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';

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

/**
 * How a lens magnifies.
 *
 * With no `render`, the lens re-draws the canvas stack's layers through a
 * zoomed camera, so it stays sharp at any factor. Over DOM content, `render`
 * draws it instead: given a camera, draw me again.
 */
export interface LoupeOptions {
  render?: (args: LoupeRenderArgs) => ReactNode;
  /** Opening magnification, clamped to the bounds below. Default 6. */
  factor?: number;
  /** What the wheel clamps to. Defaults 2 and 32. */
  minFactor?: number;
  maxFactor?: number;
  /** `'vector'` (default) re-renders the content magnified; `'pixel'` blows up
   *  the pixels the instrument presented. A `render` loupe is always vector —
   *  DOM has no framebuffer to enlarge. */
  mode?: LoupeMode;
  /** Lens diameter in CSS px. Default 200. */
  diameter?: number;
  /** Held for a momentary peek while the loupe is off. Default `'Alt'`; `null`
   *  turns hold-to-peek off. Matched against `KeyboardEvent.key`. */
  peekKey?: string | null;
  /** Called with the color under the aim, wherever the surface can say. The
   *  canvas painter reads it back; a DOM loupe has no pixels to sample. */
  onColorChange?: (hex: string) => void;
}

/** {@link LoupeOptions} with every default filled in. */
export interface ResolvedLoupe {
  render?: (args: LoupeRenderArgs) => ReactNode;
  onColorChange?: (hex: string) => void;
  factor: number;
  minFactor: number;
  maxFactor: number;
  mode: LoupeMode;
  diameter: number;
  peekKey: string | null;
}

/** What `resolveLoupe` fills in for anything a declaration leaves unset. */
export const LOUPE_DEFAULTS = {
  factor: 6,
  minFactor: 2,
  maxFactor: 32,
  mode: 'vector',
  diameter: 200,
  peekKey: 'Alt',
} as const satisfies Omit<ResolvedLoupe, 'render' | 'onColorChange'>;

/** `options` with every default filled in and `factor` clamped to
 *  `[minFactor, maxFactor]`. A loupe with its own `render` is always `'vector'`. */
export function resolveLoupe(options: LoupeOptions = {}): ResolvedLoupe {
  const minFactor = options.minFactor ?? LOUPE_DEFAULTS.minFactor;
  const maxFactor = options.maxFactor ?? LOUPE_DEFAULTS.maxFactor;
  return {
    render: options.render,
    onColorChange: options.onColorChange,
    minFactor,
    maxFactor,
    factor: Math.min(maxFactor, Math.max(minFactor, options.factor ?? LOUPE_DEFAULTS.factor)),
    diameter: options.diameter ?? LOUPE_DEFAULTS.diameter,
    peekKey: options.peekKey === undefined ? LOUPE_DEFAULTS.peekKey : options.peekKey,
    // A DOM loupe has no framebuffer, so `pixel` would have nothing to enlarge.
    mode: options.render ? 'vector' : (options.mode ?? LOUPE_DEFAULTS.mode),
  };
}
