import type { View } from '@weasel-js/core';

/** A point on the magnified surface, in its own CSS pixels. */
export interface LoupePoint {
  x: number;
  y: number;
}

/** How big a lens is, in CSS px: one number for a round or square lens, or a
 *  width and a height. */
export type LoupeSize = number | { width: number; height: number };

/** `size` as a width and a height. */
export function loupeExtent(size: LoupeSize): { width: number; height: number } {
  return typeof size === 'number' ? { width: size, height: size } : size;
}

/** The lens' rectangle on that surface. */
export interface LoupeRect extends LoupePoint {
  w: number;
  h: number;
}

/**
 * The inner `View` a loupe renders its content through: the outer view's
 * magnification times `factor`, positioned so `target` sits at the center of
 * a viewport the size of `rect`.
 */
export function loupeInnerView(
  target: LoupePoint,
  outer: View,
  rect: LoupeRect,
  factor: number,
): View {
  const scale = { x: outer.scale.x * factor, y: outer.scale.y * factor };
  return {
    x: target.x - rect.w / 2 / scale.x,
    y: target.y - rect.h / 2 / scale.y,
    scale,
  };
}

/**
 * Where on the outer surface a point inside the lens is looking, in
 * screen-space CSS px.
 *
 * The inverse of {@link loupeInnerView}: the lens centers `aim` in `rect` and
 * magnifies by `factor`, and the outer view's own scale cancels out of the
 * round trip — so this needs no `View`.
 */
export function loupeSourcePoint(
  p: LoupePoint,
  rect: LoupeRect,
  aim: LoupePoint,
  factor: number,
): LoupePoint {
  return {
    x: aim.x + (p.x - (rect.x + rect.w / 2)) / factor,
    y: aim.y + (p.y - (rect.y + rect.h / 2)) / factor,
  };
}

/** What {@link placeBand} fits. */
export interface PlaceBandArgs {
  /** The region to show whole, in host CSS px. */
  band: LoupeRect;
  /** The most it may be magnified: the lens's own factor. */
  factor: number;
  /** The host's width: the lens is never wider, and is moved to stay inside it. */
  maxWidth: number;
  /** The host's height, likewise. Omitted, the height is not limited. */
  maxHeight?: number;
}

/** A lens fitted to a band, in the shape a loupe's `place` returns. */
export interface BandPlacement {
  /** Where the lens is drawn, moved as far as staying on the host needs. */
  center: LoupePoint;
  /** The band's center, which the lens shows at its middle wherever it is drawn. */
  shows: LoupePoint;
  width: number;
  height: number;
  factor: number;
}

/**
 * A lens showing all of `band`: magnified by `factor`, or by less where that
 * would make the lens wider than `maxWidth` or taller than `maxHeight`, and
 * drawn over the band except as far as it must move to stay on the host.
 */
export function placeBand({ band, factor, maxWidth, maxHeight }: PlaceBandArgs): BandPlacement {
  let fit = factor;
  if (band.w > 0) fit = Math.min(fit, maxWidth / band.w);
  if (maxHeight !== undefined && band.h > 0) fit = Math.min(fit, maxHeight / band.h);
  const width = band.w * fit;
  const height = band.h * fit;
  const shows = { x: band.x + band.w / 2, y: band.y + band.h / 2 };
  const within = (c: number, half: number, max: number): number =>
    Math.min(Math.max(c, half), Math.max(half, max - half));
  return {
    center: {
      x: within(shows.x, width / 2, maxWidth),
      y: maxHeight === undefined ? shows.y : within(shows.y, height / 2, maxHeight),
    },
    shows,
    width,
    height,
    factor: fit,
  };
}
