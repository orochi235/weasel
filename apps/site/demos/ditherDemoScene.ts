import {
  asNodeId, fitViewToBounds,
  type Fill, type RectPose, type SceneNode, type View, type ViewportDims,
} from '@weasel-js/core';
import type { OutputGrid, Rect } from '@weasel-js/geom';

/** A label, in points. */
export const PAGE = { width: 288, height: 108 } as const;

export type DitherLayer = 'art' | 'marks';
export interface DitherNodeData {
  fill: Fill;
  shape?: 'ellipse';
  /** Marks only: how the node's protected rect grows past it. */
  mark?: 'bar' | 'rule';
}
export type DitherNode = SceneNode<DitherNodeData, DitherLayer, RectPose>;

/** A grid every dot of which is `72 / dpi` points, from the page's corner. */
export function outputGrid(dpi: number): OutputGrid {
  return { pitch: 72 / dpi, origin: { x: 0, y: 0 } };
}

/** The whole page in a canvas of `dims`. */
export function fitPage(dims: ViewportDims): View {
  return fitViewToBounds({ x: 0, y: 0, ...PAGE }, dims, { x: 0, y: 0, scale: { x: 1, y: 1 } });
}

/** Device pixels per dot that `wholeDots` opens at. */
const PX_PER_DOT = 3;
/** Between the art and the bars, so tone, a quiet zone and bar edges show at once. */
const LOOK_AT = { x: 180, y: 54 };

/**
 * `grid` at `PX_PER_DOT` device pixels a dot, with its origin on a whole
 * device pixel, so no dot straddles two. At a zoom fitting the page a 180 dpi
 * dot is under a device pixel, and every dither looks alike.
 */
export function wholeDots(grid: OutputGrid, dims: ViewportDims, dpr: number): View {
  const scale = PX_PER_DOT / (grid.pitch * dpr);
  const device = scale * dpr;
  // The view's corner, moved so the grid origin lands `round(...)` device pixels in.
  const corner = (origin: number, center: number, span: number) =>
    origin - Math.round((origin - (center - span / 2 / scale)) * device) / device;
  return {
    x: corner(grid.origin.x, LOOK_AT.x, dims.width),
    y: corner(grid.origin.y, LOOK_AT.y, dims.height),
    scale: { x: scale, y: scale },
  };
}

const linear = (from: { x: number; y: number }, to: { x: number; y: number }, a: string, b: string): Fill => ({
  paint: {
    kind: 'linear-gradient', from, to, units: 'bounds',
    stops: [{ offset: 0, color: a }, { offset: 1, color: b }],
  },
});
const radial = (a: string, b: string): Fill => ({
  paint: {
    kind: 'radial-gradient', center: { x: 0.5, y: 0.5 }, radius: 0.5, units: 'bounds',
    stops: [{ offset: 0, color: a }, { offset: 1, color: b }],
  },
});
const INK: Fill = { paint: { color: '#000000' } };

/** Gradients standing in for a photograph: a sky, a sun, a hill, and a gray ramp under them. */
const TONE: [string, RectPose, DitherNodeData][] = [
  ['sky', { x: 12, y: 12, width: 156, height: 68 }, { fill: linear({ x: 0, y: 0 }, { x: 0.3, y: 1 }, '#1d2b3a', '#e9dcc4') }],
  ['sun', { x: 104, y: 18, width: 44, height: 44 }, { shape: 'ellipse', fill: radial('#fffbe8', '#b8743c') }],
  ['hill', { x: 20, y: 50, width: 112, height: 30 }, { shape: 'ellipse', fill: radial('#6d7d5e', '#18201a') }],
  ['ramp', { x: 12, y: 84, width: 156, height: 12 }, { fill: linear({ x: 0, y: 0 }, { x: 1, y: 0 }, '#000000', '#ffffff') }],
];

/** Bar and gap widths in modules, alternating, bar first. Not an encoded symbol. */
const BARS = [2, 1, 1, 2, 3, 1, 1, 3, 2, 2, 1, 1, 4, 1, 1, 2, 2, 3, 1, 1, 1, 2, 3, 1, 2, 1, 1, 4, 2, 1, 1, 2, 1, 3, 2, 2,
  1, 1, 3, 1, 2, 1, 1, 2, 4, 1, 1, 3, 2, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 1, 2, 2, 1, 4, 1, 1, 2, 1, 3, 2, 1];
/** Narrow enough that a bar's edges fall inside a 180 or 300 dpi dot. */
const MODULE = 0.55;
const BAR_TOP = 16;
const BAR_HEIGHT = 60;
const BARCODE_X = 192;
/** Kept blank either side of the bars, and protected with them. */
export const QUIET = 8;
const BARCODE_WIDTH = BARS.reduce((sum, m) => sum + m, 0) * MODULE;
const RULE_X = BARCODE_X - QUIET;
const RULE_WIDTH = BARCODE_WIDTH + 2 * QUIET;

function barNodes(): [string, RectPose, DitherNodeData][] {
  const out: [string, RectPose, DitherNodeData][] = [];
  let x = BARCODE_X;
  BARS.forEach((modules, i) => {
    const width = modules * MODULE;
    if (i % 2 === 0) out.push([`bar-${i / 2}`, { x, y: BAR_TOP, width, height: BAR_HEIGHT }, { fill: INK, mark: 'bar' }]);
    x += width;
  });
  return out;
}

const RULES: [string, RectPose, DitherNodeData][] = [
  ['rule-a', { x: RULE_X, y: 82, width: RULE_WIDTH, height: 0.5 }, { fill: INK, mark: 'rule' }],
  ['rule-b', { x: RULE_X, y: 86, width: RULE_WIDTH, height: 0.25 }, { fill: INK, mark: 'rule' }],
  ['rule-c', { x: 12, y: 101, width: 264, height: 0.35 }, { fill: INK, mark: 'rule' }],
];

const node = (layer: DitherLayer) => ([id, pose, data]: [string, RectPose, DitherNodeData]): DitherNode => ({
  id: asNodeId(id), kind: 'mark', layer, pose, data,
});

export const INITIAL_NODES: DitherNode[] = [
  ...TONE.map(node('art')),
  ...barNodes().map(node('marks')),
  ...RULES.map(node('marks')),
];

/** What protecting a mark keeps at plain threshold: a bar with the quiet zone
 *  either side of the barcode, a rule with a point around it. Art is left to the dither. */
export function protectedRect(n: DitherNode): Rect | null {
  const p = n.pose;
  switch (n.data.mark) {
    case 'bar': return { x: p.x - QUIET, y: p.y - 1, width: p.width + 2 * QUIET, height: p.height + 2 };
    case 'rule': return { x: p.x - 1, y: p.y - 1, width: p.width + 2, height: p.height + 2 };
    default: return null;
  }
}
