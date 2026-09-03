import {
  CURSOR_HALO,
  CURSOR_HALO_WIDTH,
  CURSOR_INK,
  CURSOR_MAX_CSS_PX,
} from './types';
import type { CursorGlyph, CursorPath } from './types';

export interface BakeOptions {
  /** Rendered size in CSS px. Default 24. */
  readonly size?: number;
  /** Keyword drawn if the browser rejects the image. Default 'default'. */
  readonly fallback?: string;
}

/**
 * The halo pass. Every silhouette member is drawn once, wide, in halo colour
 * before any ink lands.
 *
 * It has to be a separate pass rather than a per-path `paint-order`: with each
 * path stroking its own halo, a later path's halo cuts a white trench through
 * an earlier path's fill wherever the two overlap. One pass under everything
 * gives the glyph a single continuous outline instead.
 */
function renderHalo(p: CursorPath): string {
  switch (p.role) {
    case 'ink':
    case 'accent':
      return (
        `<path d="${p.d}" fill="${CURSOR_HALO}" stroke="${CURSOR_HALO}"` +
        ` stroke-width="${CURSOR_HALO_WIDTH}" stroke-linejoin="round"/>`
      );
    case 'stroke':
      return (
        `<path d="${p.d}" fill="none" stroke="${CURSOR_HALO}"` +
        ` stroke-width="${p.width + CURSOR_HALO_WIDTH}"` +
        ` stroke-linecap="round" stroke-linejoin="round"/>`
      );
    // A detail IS halo-coloured and sits on top of the ink; it has no halo.
    case 'detail':
      return '';
  }
}

function renderInk(p: CursorPath): string {
  switch (p.role) {
    case 'ink':
      return `<path d="${p.d}" fill="${CURSOR_INK}"/>`;
    case 'stroke':
      return (
        `<path d="${p.d}" fill="none" stroke="${CURSOR_INK}"` +
        ` stroke-width="${p.width}" stroke-linecap="round"` +
        ` stroke-linejoin="round"/>`
      );
    case 'detail':
      return (
        `<path d="${p.d}" fill="none" stroke="${CURSOR_HALO}"` +
        ` stroke-width="${p.width}" stroke-linecap="round"/>`
      );
    case 'accent':
      return `<path d="${p.d}" fill="${p.fill}"/>`;
  }
}

/**
 * Render a glyph to a CSS cursor value.
 *
 * Ships SVG rather than a bitmap because Chrome rasterizes an SVG data-URI
 * cursor at device scale — it is already crisp on a retina display, so there
 * is no PNG pipeline and no `image-set()` here. See the spec.
 */
export function bakeCursor(glyph: CursorGlyph, opts: BakeOptions = {}): string {
  const size = opts.size ?? 24;
  if (size > CURSOR_MAX_CSS_PX) {
    throw new RangeError(
      `cursor size ${size} exceeds the ${CURSOR_MAX_CSS_PX}px cap: the browser ` +
        `would drop the image and silently fall back. Use the painted tier.`,
    );
  }
  // Halos first, then ink; within each pass, source order is z-order.
  const body = glyph.paths.map(renderHalo).join('') + glyph.paths.map(renderInk).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
    ` viewBox="0 0 ${glyph.box} ${glyph.box}">${body}</svg>`;
  const hx = Math.round((glyph.hotspot[0] / glyph.box) * size);
  const hy = Math.round((glyph.hotspot[1] / glyph.box) * size);
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `url("${uri}") ${hx} ${hy}, ${opts.fallback ?? 'default'}`;
}
