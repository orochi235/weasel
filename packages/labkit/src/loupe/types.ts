import type { LoupeMode } from '@weasel-js/loupe';
import type { ReactNode } from 'react';
import type { ViewportSize } from '../canvas/worldSpec';
import type { ViewTransform } from '../instrument/types';

/** What a DOM instrument's loupe `render` is handed: the same data its own
 *  `render` gets, and the camera to draw it through. */
export interface LoupeRenderArgs<TS = unknown, TC = unknown> {
  state: TS;
  config: TC;
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
 * Declares that an instrument can be magnified.
 *
 * With no `render`, the loupe re-draws the instrument's canvas layers through a
 * zoomed camera, so it stays sharp at any factor. An instrument whose content is
 * DOM supplies `render` instead: given a camera, draw me again.
 */
export interface LoupeCapability<TS = unknown, TC = unknown> {
  render?: (args: LoupeRenderArgs<TS, TC>) => ReactNode;
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
  /** Called with the colour under the aim, wherever the surface can say. The
   *  canvas painter reads it back; a DOM loupe has no pixels to sample. */
  onColorChange?: (hex: string) => void;
}

/** An instrument's loupe declaration. `true` takes every default. */
export type LoupeDeclaration<TS = unknown, TC = unknown> = true | LoupeCapability<TS, TC>;

/** A {@link LoupeCapability} with every default filled in. */
export interface ResolvedLoupe<TS = unknown, TC = unknown> {
  render?: (args: LoupeRenderArgs<TS, TC>) => ReactNode;
  onColorChange?: (hex: string) => void;
  factor: number;
  minFactor: number;
  maxFactor: number;
  mode: LoupeMode;
  diameter: number;
  peekKey: string | null;
}

export const LOUPE_DEFAULTS = {
  factor: 6,
  minFactor: 2,
  maxFactor: 32,
  mode: 'vector',
  diameter: 200,
  peekKey: 'Alt',
} as const satisfies Omit<ResolvedLoupe, 'render' | 'onColorChange'>;

export function resolveLoupe<TS, TC>(declared: LoupeDeclaration<TS, TC>): ResolvedLoupe<TS, TC> {
  const cap = declared === true ? {} : declared;
  const minFactor = cap.minFactor ?? LOUPE_DEFAULTS.minFactor;
  const maxFactor = cap.maxFactor ?? LOUPE_DEFAULTS.maxFactor;
  return {
    render: cap.render,
    onColorChange: cap.onColorChange,
    minFactor,
    maxFactor,
    factor: Math.min(maxFactor, Math.max(minFactor, cap.factor ?? LOUPE_DEFAULTS.factor)),
    diameter: cap.diameter ?? LOUPE_DEFAULTS.diameter,
    peekKey: cap.peekKey === undefined ? LOUPE_DEFAULTS.peekKey : cap.peekKey,
    // A DOM loupe has no framebuffer, so `pixel` would have nothing to enlarge.
    mode: cap.render ? 'vector' : (cap.mode ?? LOUPE_DEFAULTS.mode),
  };
}
