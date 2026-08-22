/**
 * Map between SVG `<pattern>` elements and weasel's `pattern` `FillStyle`.
 * The counterpart to `gradients.ts` for the other paint-server kind.
 *
 * The tile's shapes come from `tileGeometry` in core, so the vector form a
 * viewer sees is generated from the same description that rasterizes the GL
 * texture. Alongside them we write the spec itself onto a `data-weasel-tile`
 * attribute: any SVG consumer renders the shapes, and weasel reads the
 * attribute back to recover the exact spec rather than reverse-engineering
 * it from geometry.
 *
 * A pattern whose payload is a `TextureHandle` has no vector form — the
 * handle is a session-scoped registry key with no tile description behind
 * it — and exports as nothing, with a warning. Same treatment conic
 * gradients get.
 */

import { tileGeometry, type TileShape } from '@weasel-js/core/patterns-builtin';
import type { FillStyle, TilePatternSpec } from '@weasel-js/core';
import { collectElementsByTag } from './elements';
import { trimNumber } from './transform';

type PatternFill = Extract<FillStyle, { fill: 'pattern' }>;

/** Collected pattern definitions, keyed by element id. */
export type PatternTable = Map<string, FillStyle>;

/** Whether a pattern paint carries a serializable spec. */
export function patternSpecOf(paint: PatternFill): TilePatternSpec | null {
  return 'tile' in paint.pattern ? paint.pattern : null;
}

export function patternXml(id: string, paint: PatternFill, onWarn?: (m: string) => void): string {
  const spec = patternSpecOf(paint);
  if (!spec) {
    onWarn?.('pattern fill carries a TextureHandle, which has no vector form — omitted from <defs>');
    return '';
  }
  const geometry = tileGeometry(spec);
  const body = geometry.shapes.map(shapeXml).join('');
  const origin = paint.origin ?? { x: 0, y: 0 };
  const attrs = [
    `id="${id}"`,
    'patternUnits="userSpaceOnUse"',
    `width="${trimNumber(geometry.size)}"`,
    `height="${trimNumber(geometry.size)}"`,
  ];
  if (origin.x !== 0 || origin.y !== 0) {
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
    ? `<rect width="${s}" height="${s}" fill="${background}"/>`
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
        + `r="${trimNumber(shape.r)}" fill="${shape.color}"/>`;
    case 'ellipse': {
      const deg = (shape.rotation * 180) / Math.PI;
      const transform = deg === 0
        ? ''
        : ` transform="rotate(${trimNumber(deg)} ${trimNumber(shape.cx)} ${trimNumber(shape.cy)})"`;
      return `<ellipse cx="${trimNumber(shape.cx)}" cy="${trimNumber(shape.cy)}" `
        + `rx="${trimNumber(shape.rx)}" ry="${trimNumber(shape.ry)}" `
        + `fill="${shape.color}"${transform}/>`;
    }
    case 'rect':
      return `<rect x="${trimNumber(shape.x)}" y="${trimNumber(shape.y)}" `
        + `width="${trimNumber(shape.width)}" height="${trimNumber(shape.height)}" `
        + `fill="${shape.color}"/>`;
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

function readPattern(el: Element, onWarn?: (m: string) => void): FillStyle | null {
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
  if (typeof spec?.tile !== 'string' || typeof spec?.color !== 'string') {
    onWarn?.(`<pattern id="${el.getAttribute('id')}"> data-weasel-tile is not a tile spec — dropped`);
    return null;
  }
  const x = parseFloat(el.getAttribute('x') ?? '0');
  const y = parseFloat(el.getAttribute('y') ?? '0');
  const paint: PatternFill = { fill: 'pattern', pattern: spec };
  if (x !== 0 || y !== 0) paint.origin = { x, y };
  return paint;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
