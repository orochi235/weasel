/**
 * Map between SVG `<pattern>` elements and weasel's pattern paints.
 *
 * The tile's shapes are written for any SVG consumer to render, and the spec
 * itself goes on a `data-weasel-tile` attribute, which weasel reads back
 * rather than reverse-engineering it from geometry. An `image` paint is a
 * pattern holding one `<image>` that fills the tile, the form other editors
 * write a bitmap pattern in too, and is read back from that structure. A
 * `texture` paint has no vector form and exports as nothing, with a warning.
 */

import { escapeAttr } from './xmlEscape';
import { tileGeometry, type TileShape } from '@weasel-js/core/patterns-builtin';
import {
  isImagePatternPaint, isTileKind, isTilePaint, tileSpecOf,
  type ImagePatternPaint, type Paint, type PatternPaint, type PatternPlacement,
  type TilePaint, type TilePatternSpec,
} from '@weasel-js/core';
import { collectElementsByTag } from './elements';
import { imageHref } from './readImage';
import { applyMatrix, formatMatrix, isIdentity, parseTransform, trimNumber } from './transform';

/** Collected pattern definitions, keyed by element id. */
export type PatternTable = Map<string, Paint>;

export function patternXml(id: string, paint: PatternPaint, onWarn?: (m: string) => void): string {
  if (isImagePatternPaint(paint)) return imagePatternXml(id, paint, onWarn);
  if (!isTilePaint(paint)) {
    onWarn?.('texture fill carries a TextureHandle, which has no vector form — omitted from <defs>');
    return '';
  }
  const spec = tileSpecOf(paint);
  const geometry = tileGeometry(spec);
  const body = geometry.shapes.map(shapeXml).join('');
  const attrs = [
    ...patternBoxAttrs(id, geometry.size, geometry.size, paint),
    `data-weasel-tile="${escapeAttr(JSON.stringify(spec))}"`,
  ];
  return `<pattern ${attrs.join(' ')}>${body}</pattern>`;
}

function imagePatternXml(id: string, paint: ImagePatternPaint, onWarn?: (m: string) => void): string {
  const { width, height } = paint;
  if (!(width! > 0) || !(height! > 0)) {
    // SVG sizes a tile on the pattern itself; it cannot fall back to the
    // picture's own size the way the renderer does.
    onWarn?.('image fill names no tile width and height, which an SVG pattern needs — omitted from <defs>');
    return '';
  }
  const w = trimNumber(width!);
  const h = trimNumber(height!);
  const body = `<image href="${escapeAttr(paint.src)}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
  return `<pattern ${patternBoxAttrs(id, width!, height!, paint).join(' ')}>${body}</pattern>`;
}

/** The attributes placing a tile of `width` × `height` where `paint` puts it. */
function patternBoxAttrs(id: string, width: number, height: number, paint: PatternPlacement): string[] {
  const origin = paint.origin ?? { x: 0, y: 0 };
  const attrs = [
    `id="${id}"`,
    'patternUnits="userSpaceOnUse"',
    `width="${trimNumber(width)}"`,
    `height="${trimNumber(height)}"`,
  ];
  // A transform carries the origin as its translation, since SVG applies
  // patternTransform to x/y as well; without one, x/y is the plainer form.
  const [a, b, c, d] = paint.transform ?? [1, 0, 0, 1];
  const placement = formatMatrix([a, b, c, d, origin.x, origin.y]);
  if (paint.transform && !isIdentity([a, b, c, d, 0, 0]) && placement) {
    attrs.push(`patternTransform="${placement}"`);
  } else if (origin.x !== 0 || origin.y !== 0) {
    attrs.push(`x="${trimNumber(origin.x)}"`, `y="${trimNumber(origin.y)}"`);
  }
  return attrs;
}

/**
 * A single tile as a standalone `<svg>` document, sized to its own extent,
 * for UI that shows a tile outside a document, such as a picker swatch.
 */
export function tilePreviewSvg(spec: TilePatternSpec, background?: string): string {
  const geometry = tileGeometry(spec);
  const s = trimNumber(geometry.size);
  const bg = background
    ? `<rect width="${s}" height="${s}" fill="${escapeAttr(background)}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" `
    + `viewBox="0 0 ${s} ${s}">${bg}${geometry.shapes.map(shapeXml).join('')}</svg>`;
}

/** `tilePreviewSvg` packed as a `url(...)` value for CSS `background-image`. */
export function tilePreviewCssUrl(spec: TilePatternSpec, background?: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(tilePreviewSvg(spec, background))}")`;
}

function shapeXml(shape: TileShape): string {
  switch (shape.kind) {
    case 'line':
      return `<line x1="${trimNumber(shape.x1)}" y1="${trimNumber(shape.y1)}" `
        + `x2="${trimNumber(shape.x2)}" y2="${trimNumber(shape.y2)}" `
        + `stroke="${shape.color}" stroke-width="${trimNumber(shape.width)}"/>`;
    case 'circle':
      return `<circle cx="${trimNumber(shape.cx)}" cy="${trimNumber(shape.cy)}" `
        + `r="${trimNumber(shape.r)}" fill="${escapeAttr(shape.color)}"/>`;
    case 'ellipse': {
      const deg = (shape.rotation * 180) / Math.PI;
      const transform = deg === 0
        ? ''
        : ` transform="rotate(${trimNumber(deg)} ${trimNumber(shape.cx)} ${trimNumber(shape.cy)})"`;
      return `<ellipse cx="${trimNumber(shape.cx)}" cy="${trimNumber(shape.cy)}" `
        + `rx="${trimNumber(shape.rx)}" ry="${trimNumber(shape.ry)}" `
        + `fill="${escapeAttr(shape.color)}"${transform}/>`;
    }
    case 'rect':
      return `<rect x="${trimNumber(shape.x)}" y="${trimNumber(shape.y)}" `
        + `width="${trimNumber(shape.width)}" height="${trimNumber(shape.height)}" `
        + `fill="${escapeAttr(shape.color)}"/>`;
    default:
      return '';
  }
}

/** Read every `<pattern>` in the document back into pattern paints. */
export function collectPatterns(svg: Element, onWarn?: (m: string) => void): PatternTable {
  const out: PatternTable = new Map();
  for (const [id, el] of collectElementsByTag(svg, PATTERN_TAGS)) {
    const paint = readPattern(el, onWarn);
    if (paint) out.set(id, paint);
  }
  return out;
}

const PATTERN_TAGS = new Set(['pattern']);

function readPattern(el: Element, onWarn?: (m: string) => void): Paint | null {
  const raw = el.getAttribute('data-weasel-tile');
  const image = raw ? null : readImagePattern(el);
  if (image) return image;
  if (!raw) {
    // A hand-authored pattern (Illustrator, Inkscape) holds arbitrary
    // geometry no `TilePatternSpec` can express.
    onWarn?.(`<pattern id="${el.getAttribute('id')}"> has no data-weasel-tile — unsupported pattern, dropped`);
    return null;
  }
  let spec: TilePatternSpec;
  try {
    spec = JSON.parse(raw) as TilePatternSpec;
  } catch {
    onWarn?.(`<pattern id="${el.getAttribute('id')}"> has malformed data-weasel-tile — dropped`);
    return null;
  }
  if (!isTileKind(spec?.kind) || typeof spec?.color !== 'string') {
    onWarn?.(`<pattern id="${el.getAttribute('id')}"> data-weasel-tile is not a tile spec — dropped`);
    return null;
  }
  return { ...spec, ...readPlacement(el, onWarn) } satisfies TilePaint;
}

/**
 * A pattern whose only content is one `<image>` filling its tile, as an
 * `image` paint; `null` for any other pattern. Only a tile sized in user
 * space qualifies: a pattern sized as fractions of the shape it fills, or
 * one whose picture is offset or scaled within the tile, has no `image`
 * paint that draws the same.
 */
function readImagePattern(el: Element): ImagePatternPaint | null {
  const children = Array.from(el.children);
  const img = children[0];
  if (children.length !== 1 || img.localName !== 'image') return null;
  if (el.getAttribute('patternUnits') !== 'userSpaceOnUse') return null;
  if (el.hasAttribute('viewBox') || el.hasAttribute('patternContentUnits')) return null;
  const src = imageHref(img);
  const width = parseFloat(el.getAttribute('width') ?? '');
  const height = parseFloat(el.getAttribute('height') ?? '');
  if (!src || !(width > 0) || !(height > 0)) return null;
  const at = (name: string, fallback: number) => parseFloat(img.getAttribute(name) ?? String(fallback));
  if (at('x', 0) !== 0 || at('y', 0) !== 0 || at('width', width) !== width || at('height', height) !== height) {
    return null;
  }
  return { kind: 'image', src, width, height, ...readPlacement(el) };
}

/** A pattern element's `x` / `y` and `patternTransform`, as a paint's
 *  `origin` and `transform`, each present only when it moves the tile. */
function readPlacement(el: Element, onWarn?: (m: string) => void): PatternPlacement {
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const m = parseTransform(el.getAttribute('patternTransform'), onWarn);
  const origin = applyMatrix(m, x, y);
  const placement: PatternPlacement = {};
  if (origin.x !== 0 || origin.y !== 0) placement.origin = origin;
  if (!isIdentity([m[0], m[1], m[2], m[3], 0, 0])) placement.transform = [m[0], m[1], m[2], m[3]];
  return placement;
}
