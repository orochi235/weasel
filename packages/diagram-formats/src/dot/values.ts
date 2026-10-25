/** Graphviz DOT's attribute values as a diagram reads and writes them: labels, colors, shapes, and arrowheads. */
import type { MarkerRef } from '@weasel-js/core';
import type { Outline } from '@weasel-js/diagram';
import { hex2, markupLines } from '../graphRead';
import type { DotValue } from './parse';

/** A label's lines: an HTML label's text, else the string with its escapes read. `\N` names `self`, `\G` the graph. */
export function labelLines(label: DotValue, self: string, graph: string): string[] {
  if (label.html) return markupLines(label.value).filter((l, i, all) => l !== '' || (i > 0 && i < all.length - 1));
  const lines = [''];
  const text = label.value;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c !== '\\' || i === text.length - 1) { lines[lines.length - 1] += c; continue; }
    const next = text[++i]!;
    if (next === 'n' || next === 'l' || next === 'r') lines.push('');
    else if (next === 'N') lines[lines.length - 1] += self;
    else if (next === 'G') lines[lines.length - 1] += graph;
    else lines[lines.length - 1] += next;
  }
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.length === 1 && lines[0] === '' ? [] : lines;
}

/** `text` as a quoted DOT string: backslashes and quotes escaped, line breaks as `\n`. */
export function quoteLabel(lines: readonly string[]): string {
  return `"${lines.map((l) => l.replace(/\\/g, '\\\\').replace(/"/g, '\\"')).join('\\n')}"`;
}

function hsvHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${hex2(f(5))}${hex2(f(3))}${hex2(f(1))}`;
}

/** A color as CSS reads it: the first of a list, its scheme dropped, an HSV triple as hex. */
export function dotColor(value: string): string {
  const first = value.split(':')[0]!.split(';')[0]!.trim();
  const hsv = /^([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)$/.exec(first);
  if (hsv !== null) return hsvHex(Number(hsv[1]), Number(hsv[2]), Number(hsv[3]));
  return first.replace(/^\/[^/]*\//, '');
}

const OUTLINES: Readonly<Record<string, Outline>> = {
  box: 'rect', rect: 'rect', rectangle: 'rect', square: 'rect',
  ellipse: 'ellipse', oval: 'ellipse', circle: 'ellipse', doublecircle: 'doubleEllipse', point: 'ellipse',
  diamond: 'diamond', hexagon: 'hexagon', parallelogram: 'parallelogram', trapezium: 'trapezoid',
  cylinder: 'cylinder', note: 'note', folder: 'folder', tab: 'folder', octagon: 'octagon', triangle: 'triangle', box3d: 'cube',
};

/** Outlines DOT names differently, or draws as a rounded box. */
const SHAPE_NAMES: Readonly<Record<string, { shape: string; rounded?: boolean }>> = {
  stadium: { shape: 'box', rounded: true }, roundRect: { shape: 'box', rounded: true }, trapezoid: { shape: 'trapezium' },
  cube: { shape: 'box3d' }, doubleEllipse: { shape: 'doublecircle' },
};

/** The outlines DOT has a shape of the same name for. */
const SAME_NAMES: ReadonlySet<string> = new Set([
  'diamond', 'ellipse', 'hexagon', 'parallelogram', 'cylinder', 'note', 'folder', 'octagon', 'triangle',
]);

/** The outline a shape and style draw as, or `null` for a shape the diagram has none for. */
export function outlineOf(shape: string, styles: readonly string[]): Outline | null {
  const outline = OUTLINES[shape.toLowerCase()];
  if (outline === undefined) return null;
  return outline === 'rect' && styles.includes('rounded') ? 'stadium' : outline;
}

/** The shape and the style word an outline writes as; a drawn path as a box,
 *  and a name DOT has no shape for as a box marked `missing`. */
export function shapeOf(outline: Outline | undefined): { shape: string; rounded?: boolean; missing?: true } {
  if (outline === undefined || typeof outline !== 'string' || outline === 'rect') return { shape: 'box' };
  return SHAPE_NAMES[outline] ?? (SAME_NAMES.has(outline) ? { shape: outline } : { shape: 'box', missing: true });
}

const ARROWS: Readonly<Record<string, MarkerRef | null>> = {
  normal: 'arrow', inv: 'arrow', none: null, dot: 'circle', odot: 'circle', diamond: 'diamond', odiamond: 'diamond-hollow',
  box: 'square', obox: 'square', tee: 'bar', empty: 'arrow-open', onormal: 'triangle-hollow', vee: 'arrow-concave',
  crow: 'crow-many', teetee: 'crow-one', teeodot: 'crow-zero-one', crowtee: 'crow-one-many', crowodot: 'crow-zero-many',
};

const ARROW_NAMES: Readonly<Record<string, string>> = {
  arrow: 'normal', 'arrow-open': 'empty', 'arrow-concave': 'vee', diamond: 'diamond', 'diamond-hollow': 'odiamond',
  circle: 'dot', square: 'box', bar: 'tee', 'triangle-hollow': 'onormal',
  'crow-many': 'crow', 'crow-one': 'teetee', 'crow-zero-one': 'teeodot', 'crow-one-many': 'crowtee', 'crow-zero-many': 'crowodot',
};

/** The marker an arrowhead name draws: `undefined` for a name the diagram has none for. */
export const markerOf = (name: string): MarkerRef | null | undefined => ARROWS[name.toLowerCase()];

/** The arrowhead name a marker writes as: `undefined` for a marker DOT has none for. */
export function arrowName(marker: MarkerRef): string | undefined {
  return ARROW_NAMES[typeof marker === 'string' ? marker : marker.key];
}

/** A DOT style list's words. */
export const stylesOf = (style: string | undefined): string[] =>
  style === undefined ? [] : style.split(',').map((s) => s.trim().replace(/\(.*$/, '').toLowerCase()).filter((s) => s !== '');

/** The dash a `dashed` or `dotted` style draws. */
export function dashOf(styles: readonly string[]): number[] | undefined {
  if (styles.includes('dashed')) return [6, 4];
  if (styles.includes('dotted')) return [2, 3];
  return undefined;
}
