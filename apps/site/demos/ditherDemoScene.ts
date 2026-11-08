import {
  HOME_VIEW, asNodeId, fitViewToBounds, quantizeSize,
  type Fill, type QuantizeRule, type RectPose, type SceneNode, type View, type ViewportDims,
} from '@weasel-js/core';
import { alignToGrid, pathFromD, snapToPitch, type OutputGrid, type Path, type Rect } from '@weasel-js/geom';

/** A label, in points. */
export const PAGE = { width: 288, height: 108 } as const;

export type DitherLayer = 'art' | 'marks';
export interface DitherNodeData {
  fill: Fill;
  shape?: 'ellipse';
  /** Marks only: how the node's protected rect grows past it, and how it snaps to the dots. */
  mark?: 'barcode' | 'rule';
  /** A barcode's bars, in modules across and one unit tall; the painter fits them to the pose. */
  path?: Path;
  /** A barcode's width in modules. */
  modules?: number;
}
export type DitherNode = SceneNode<DitherNodeData, DitherLayer, RectPose>;

/** A grid every dot of which is `72 / dpi` points, from the page's corner. */
export function outputGrid(dpi: number): OutputGrid {
  return { pitch: 72 / dpi, origin: { x: 0, y: 0 } };
}

/** The whole page in a canvas of `dims`. */
export function fitPage(dims: ViewportDims): View {
  return fitViewToBounds({ x: 0, y: 0, ...PAGE }, dims, HOME_VIEW) ?? HOME_VIEW;
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
export const BARS = [2, 1, 1, 2, 3, 1, 1, 3, 2, 2, 1, 1, 4, 1, 1, 2, 2, 3, 1, 1, 1, 2, 3, 1, 2, 1, 1, 4, 2, 1, 1, 2, 1, 3, 2, 2,
  1, 1, 3, 1, 2, 1, 1, 2, 4, 1, 1, 3, 2, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 2, 3, 1, 1, 2, 2, 1, 4, 1, 1, 2, 1, 3, 2, 1];
/** Narrow enough that a bar's edges fall inside a 180 or 300 dpi dot. */
export const MODULE = 0.55;
const BAR_TOP = 16;
const BAR_HEIGHT = 60;
const BARCODE_X = 192;
/** Kept blank either side of the bars, and protected with them. */
export const QUIET = 8;
const MODULES = BARS.reduce((sum, m) => sum + m, 0);
const BARCODE_WIDTH = MODULES * MODULE;
const RULE_X = BARCODE_X - QUIET;
const RULE_WIDTH = BARCODE_WIDTH + 2 * QUIET;

/** The bars as one path, a rect per bar. */
function barsPath(): Path {
  let at = 0;
  const d = BARS.map((m, i) => {
    const bar = i % 2 === 0 ? `M${at} 0H${at + m}V1H${at}Z` : '';
    at += m;
    return bar;
  });
  return pathFromD(d.join(''));
}

const BARCODE: [string, RectPose, DitherNodeData] = [
  'barcode',
  { x: BARCODE_X, y: BAR_TOP, width: BARCODE_WIDTH, height: BAR_HEIGHT },
  { fill: INK, mark: 'barcode', path: barsPath(), modules: MODULES },
];

const RULES: [string, RectPose, DitherNodeData][] = [
  ['rule-a', { x: RULE_X, y: 82, width: RULE_WIDTH, height: 0.5 }, { fill: INK, mark: 'rule' }],
  ['rule-b', { x: RULE_X, y: 86, width: RULE_WIDTH, height: 0.25 }, { fill: INK, mark: 'rule' }],
  ['rule-c', { x: 12, y: 101, width: 264, height: 0.35 }, { fill: INK, mark: 'rule' }],
];

const node = (layer: DitherLayer) => ([id, pose, data]: [string, RectPose, DitherNodeData]): DitherNode => ({
  id: asNodeId(id), kind: 'mark', layer, parent: null, pose, data,
});

export const INITIAL_NODES: DitherNode[] = [
  ...TONE.map(node('art')),
  node('marks')(BARCODE),
  ...RULES.map(node('marks')),
];

/** What protecting a mark keeps at plain threshold: the barcode with its quiet
 *  zone either side, a rule with a point around it. Art is left to the dither. */
export function protectedRect(n: DitherNode): Rect | null {
  const p = n.pose;
  switch (n.data.mark) {
    case 'barcode': return { x: p.x - QUIET, y: p.y - 1, width: p.width + 2 * QUIET, height: p.height + 2 };
    case 'rule': return { x: p.x - 1, y: p.y - 1, width: p.width + 2, height: p.height + 2 };
    default: return null;
  }
}

/**
 * The marks on the printer's dots. A barcode's module is a whole number of
 * dots, so every module prints alike, and its width is that module times its
 * modules, in the document, so W shows the size it prints. A rule is a whole
 * number of dots each way, at least one, so a hairline prints. Both are drawn
 * with their corner on a dot. The art is left to the dither.
 */
export const DOT_RULE: QuantizeRule<DitherNodeData, RectPose> = {
  stored({ data, pose }, grid, anchor) {
    if (!data.mark) return null;
    const width = data.modules
      ? data.modules * snapToPitch(pose.width / data.modules, grid.pitch)
      : snapToPitch(pose.width, grid.pitch);
    const height = snapToPitch(pose.height, grid.pitch);
    return width === pose.width && height === pose.height ? null : { pose: quantizeSize(pose, width, height, anchor) };
  },
  drawn: ({ data, pose }, grid) => (data.mark ? alignToGrid(pose, grid) : pose),
};
