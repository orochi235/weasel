/**
 * Map between SVG `<pattern>` elements and weasel's pattern paints.
 * The counterpart to `gradients.ts` for the other paint-server kind.
 *
 * The tile's shapes come from `tileGeometry` in core, so the vector form a
 * viewer sees is generated from the same description that rasterizes the GL
 * texture. Alongside them we write the spec itself onto a `data-weasel-tile`
 * attribute: any SVG consumer renders the shapes, and weasel reads the
 * attribute back to recover the exact spec rather than reverse-engineering
 * it from geometry.
 *
 * A `texture` paint has no vector form — its handle is a session-scoped
 * registry key with no tile description behind it — and exports as nothing,
 * with a warning. Same treatment conic
 * gradients get.
 */

import { escapeAttr } from './xmlEscape';
import { tileGeometry, type TileShape } from '@weasel-js/core/patterns-builtin';
import {
  isTileKind, isTilePaint, tileSpecOf,
  type Paint, type PatternPaint, type TilePaint, type TilePatternSpec,
} from '@weasel-js/core';
import { collectElementsByTag } from './elements';
import { applyMatrix, formatMatrix, isIdentity, parseTransform, trimNumber } from './transform';

/** Collected pattern definitions, keyed by element id. */
export type PatternTable = Map<string, Paint>;

export function patternXml(id: string, paint: PatternPaint, onWarn?: (m: string) => void): string {
  if (!isTilePaint(paint)) {
    onWarn?.('texture fill carries a TextureHandle, which has no vector form — omitted from <defs>');
    return '';
  }
  const spec = tileSpecOf(paint);
  const geometry = tileGeometry(spec);
  const body = geometry.shapes.map(shapeXml).join('');
  const origin = paint.origin ?? { x: 0, y: 0 };
  const attrs = [
    `id="${id}"`,
    'patternUnits="userSpaceOnUse"',
    `width="${trimNumber(geometry.size)}"`,
    `height="${trimNumber(geometry.size)}"`,
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
  attrs.push(`data-weasel-tile="${escapeAttr(JSON.stringify(spec))}"`);
  return `<pattern ${attrs.join(' ')}>${body}</pattern>`;
}

/**
 * A single tile as a standalone `<svg>` document, sized to its own extent.
 * For UI that needs to show a tile outside a document — a picker swatch,
 * set as a repeating CSS `background-image` via a data URI. Shares the shape
 * mapper with `patternXml`, so a preview can't drift from what paints.
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
  if (!raw) {
    // A hand-authored pattern (Illustrator, Inkscape) holds arbitrary
    // geometry no `TilePatternSpec` can express. Recognizing it would mean
    // reverse-engineering a tile from its children; dropping it with a
    // warning is honest, and the element survives in the source file.
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
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const m = parseTransform(el.getAttribute('patternTransform'), onWarn);
  const origin = applyMatrix(m, x, y);
  const paint: TilePaint = { ...spec };
  if (origin.x !== 0 || origin.y !== 0) paint.origin = origin;
  if (!isIdentity([m[0], m[1], m[2], m[3], 0, 0])) paint.transform = [m[0], m[1], m[2], m[3]];
  return paint;
}
