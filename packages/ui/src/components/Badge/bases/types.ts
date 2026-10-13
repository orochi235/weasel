import type { ReactNode } from 'react';
import type { BadgeVariant, ShapeInsets } from '../types';

export interface PerimeterPoint {
  /** viewBox coordinate (0..100). */
  x: number;
  /** viewBox coordinate (0..100). */
  y: number;
  /** Outward-pointing normal, unit length in viewBox terms. */
  nx: number;
  ny: number;
}

export interface BaseSampler {
  /** SVG path for the body's outline. */
  bodyPath: string;
  /** Sample a perimeter point at CSS arc length `s`. Wraps around `totalCss`. */
  perimeterAt: (s: number) => PerimeterPoint;
  /** Total perimeter length in CSS pixels. */
  totalCss: number;
}

export interface BaseModule<P = Record<string, never>> {
  build: (params: P, boxW: number, boxH: number) => BaseSampler;
  defaults?: P;
  insets?: ShapeInsets | ((params: P) => ShapeInsets);
  /**
   * Set on a base whose outline dips inside its box and takes no size from the box, only its
   * proportions. Fixed insets cannot hold content inside such an outline, since it dips further
   * the longer the content is, so `insets` is then the least the base pads by, and each side grows by
   * what the outline and the content's measured size call for.
   */
  fitsContent?: boolean;
}

export interface EffectRenderProps<P = Record<string, never>> {
  sampler: BaseSampler;
  boxW: number;
  boxH: number;
  variant: BadgeVariant;
  params: P;
  phase: number;
}

export interface EffectOffsetCtx<P = Record<string, never>> {
  totalCss: number;
  perimeterAt: (s: number) => PerimeterPoint;
  params: P;
  phase: number;
}

/**
 * An effect layers visual treatment on top of the base shape. Two modes:
 *
 * - **offsetAt**: warp the perimeter. At each sample point `s` along the base perimeter,
 *   the effect contributes an additive (dx, dy) in CSS px to displace that sample;
 *   the caller scales it to the viewBox. Multiple offset-style effects in the same badge
 *   compose by summing their offsets.
 * - **Component + zone**: draw decoration (bevel, sheen, woodgrain, rivets, shadow)
 *   without changing the silhouette. Decorations typically clip to the current sampler.
 *
 * An effect may provide either or both.
 */
export interface EffectModule<P = Record<string, never>> {
  offsetAt?: (s: number, ctx: EffectOffsetCtx<P>) => { dx: number; dy: number };
  Component?: (props: EffectRenderProps<P>) => ReactNode;
  /** Where decoration sits relative to the body silhouette.
   *  - `'background'` paints before the body (under the fill/stroke).
   *  - `'foreground'` (default) paints after the body.
   *  - `'mask'` contributes black shapes to an SVG mask applied to the body fill/stroke,
   *    effectively punching holes through the silhouette. */
  zone?: 'background' | 'foreground' | 'mask';
  defaults?: P;
}
