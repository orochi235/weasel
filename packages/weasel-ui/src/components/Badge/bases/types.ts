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

/**
 * An effect that layers visual treatment on top of the base shape.
 *
 * Effects can express any of: border decorations (spikes, scallops, bites),
 * face/background treatments (bevel, sheen, woodgrain), inner ornament,
 * shadows, or anything else that draws into the badge's SVG canvas.
 *
 * They receive the base's perimeter sampler so border-style effects can place
 * elements around the body's actual outline regardless of the underlying base shape.
 */
export interface EffectModule<P = Record<string, never>> {
  Component: (props: {
    sampler: BaseSampler;
    boxW: number;
    boxH: number;
    variant: BadgeVariant;
    params: P;
    phase: number;
  }) => ReactNode;
  defaults?: P;
}
