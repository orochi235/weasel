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
}

export interface EffectRenderProps<P = Record<string, never>> {
  sampler: BaseSampler;
  boxW: number;
  boxH: number;
  variant: BadgeVariant;
  params: P;
  phase: number;
}

export interface EffectTransformCtx<P = Record<string, never>> {
  boxW: number;
  boxH: number;
  params: P;
  phase: number;
}

/**
 * An effect layers visual treatment on top of the base shape. Two modes:
 *
 * - **transform**: replace the badge's silhouette. Spikes/scallops/bites/puffs use this —
 *   they hand back a new sampler whose `bodyPath` is the warped outline. Multiple
 *   transforms apply in array order; each receives the previous output.
 * - **Component + zone**: draw decoration (bevel, sheen, woodgrain, rivets, shadow)
 *   without changing the silhouette. `zone: 'background'` draws before the body,
 *   `'foreground'` draws after. Decorations typically clip to the current sampler.
 *
 * An effect may provide one, the other, or both.
 */
export interface EffectModule<P = Record<string, never>> {
  transform?: (input: BaseSampler, ctx: EffectTransformCtx<P>) => BaseSampler;
  Component?: (props: EffectRenderProps<P>) => ReactNode;
  /** Where decoration sits relative to the body silhouette. Default 'foreground'. */
  zone?: 'background' | 'foreground';
  defaults?: P;
}
