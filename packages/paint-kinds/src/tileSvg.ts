/**
 * A tile pattern as SVG markup: each shape of its geometry, and the tile alone
 * as a standalone document a swatch can show.
 */
import { RAD_TO_DEG, trimNumber } from '@weasel-js/geom';
import type { TilePatternSpec } from '@weasel-js/paint';
import { escapeAttr } from '@weasel-js/registry';
import { tileGeometry, type TileShape } from '@weasel-js/renderer/patterns-builtin';

/** One shape of a tile as SVG markup: what a `<pattern>` holds, and a preview's body. */
export function tileShapeXml(shape: TileShape): string {
  switch (shape.kind) {
    case 'line':
      return `<line x1="${trimNumber(shape.x1)}" y1="${trimNumber(shape.y1)}" `
        + `x2="${trimNumber(shape.x2)}" y2="${trimNumber(shape.y2)}" `
        + `stroke="${escapeAttr(shape.color)}" stroke-width="${trimNumber(shape.width)}"/>`;
    case 'circle':
      return `<circle cx="${trimNumber(shape.cx)}" cy="${trimNumber(shape.cy)}" `
        + `r="${trimNumber(shape.r)}" fill="${escapeAttr(shape.color)}"/>`;
    case 'ellipse': {
      const deg = shape.rotation * RAD_TO_DEG;
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
    + `viewBox="0 0 ${s} ${s}">${bg}${geometry.shapes.map(tileShapeXml).join('')}</svg>`;
}

/** `tilePreviewSvg` packed as a `url(...)` value for CSS `background-image`. */
export function tilePreviewCssUrl(spec: TilePatternSpec, background?: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(tilePreviewSvg(spec, background))}")`;
}
