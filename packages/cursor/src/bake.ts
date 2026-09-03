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

function renderPath(p: CursorPath): string {
  switch (p.role) {
    case 'ink':
      return (
        `<path d="${p.d}" fill="${CURSOR_INK}" stroke="${CURSOR_HALO}"` +
        ` stroke-width="${CURSOR_HALO_WIDTH}" stroke-linejoin="round"` +
        ` paint-order="stroke fill"/>`
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
  // Paths emit in source order, which is z-order.
  const body = glyph.paths.map(renderPath).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
    ` viewBox="0 0 ${glyph.box} ${glyph.box}">${body}</svg>`;
  const hx = Math.round((glyph.hotspot[0] / glyph.box) * size);
  const hy = Math.round((glyph.hotspot[1] / glyph.box) * size);
  const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return `url("${uri}") ${hx} ${hy}, ${opts.fallback ?? 'default'}`;
}
