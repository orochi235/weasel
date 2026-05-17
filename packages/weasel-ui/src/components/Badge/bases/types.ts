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

export interface EffectOffsetCtx<P = Record<string, never>> {
  /** CSS px offset from the base perimeter point, in CSS px (caller scales to viewBox). */
  totalCss: number;
  perimeterAt: (s: number) => PerimeterPoint;
  params: P;
  phase: number;
}

/**
 * An effect layers visual treatment on top of the base shape. Two modes:
 *
 * - **offsetAt**: warp the perimeter. At each sample point `s` along the base perimeter,
 *   the effect contributes an additive (dx, dy) in CSS px to displace that sample.
 *   Spikes/puffs/bites/scallops use this. Multiple offset-style effects in the same badge
 *   compose by summing their offsets — so `[bites, spikes]` honestly draws a bitten outline
 *   with spikes radiating from it (the spike center samples just sit further out, but the
 *   inner bite samples between spikes still dip in).
 * - **Component + zone**: draw decoration (bevel, sheen, woodgrain, rivets, shadow)
 *   without changing the silhouette. `zone: 'background'` draws before the body,
 *   `'foreground'` draws after. Decorations typically clip to the current sampler.
 *
 * An effect may provide either or both.
 */
export interface EffectModule<P = Record<string, never>> {
  offsetAt?: (s: number, ctx: EffectOffsetCtx<P>) => { dx: number; dy: number };
  Component?: (props: EffectRenderProps<P>) => ReactNode;
  /** Where decoration sits relative to the body silhouette. Default 'foreground'. */
  zone?: 'background' | 'foreground';
  defaults?: P;
}
