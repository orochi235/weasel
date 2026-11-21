import { resolveEdge, type EdgeCap, type EdgePoint } from './edgeProfiles';
import { withDefaults } from '../shapes/params';
import type { BaseModule, BaseSampler } from './types';
import { polygonSampler } from './polygonSampler';
import { maxOf, trimNumber } from '@weasel-js/geom';

/** What `baseParams` takes on a badge whose `base` is `powerline`. */
export interface BadgePowerlineBaseParams {
  /** Profile for the left edge (the cap segment N inherits from segment N-1). */
  leftEdge?: EdgeCap;
  /** Profile for the right edge (this segment's own end cap). */
  rightEdge?: EdgeCap;
  /** Protrusion depth in CSS px (positive values stick out beyond the rect). */
  depth?: number;
}

const DEFAULTS: Required<BadgePowerlineBaseParams> = {
  leftEdge: 'flat',
  rightEdge: 'flat',
  depth: 6,
};

// Insets can't see the measured height. Profile averages don't depend on it;
// a cap whose shape does (puzzle) is averaged at a typical row height.
const INSETS_HEIGHT = 20;

const Powerline: BaseModule<BadgePowerlineBaseParams> = {
  build: (params, boxW, boxH) => {
    const cfg = withDefaults(DEFAULTS, params);
    const left = resolveEdge(cfg.leftEdge)(cfg.depth, boxH);
    const right = resolveEdge(cfg.rightEdge)(cfg.depth, boxH);
    const sx = 100 / boxW;
    const sy = 100 / boxH;

    const pts: [number, number][] = [];

    // Top corners are the edges' own first points, so a profile that
    // protrudes/cuts at the top (e.g. slant-up) doesn't introduce a corner
    // kink between the flat top and the edge.
    pts.push([left[0].x * sx, left[0].y * sy]);
    for (let i = 0; i < right.length; i++) {
      pts.push([(boxW + right[i].x) * sx, right[i].y * sy]);
    }
    for (let i = left.length - 1; i >= 1; i--) {
      pts.push([left[i].x * sx, left[i].y * sy]);
    }
    const { perimeterAt, totalCss } = polygonSampler(pts, boxW, boxH);

    const bodyPath = pts.reduce(
      (acc, [x, y], i) => `${acc}${i === 0 ? 'M' : ' L'} ${trimNumber(x, 3)} ${trimNumber(y, 3)}`,
      ''
    ) + ' Z';

    const sampler: BaseSampler = { bodyPath, perimeterAt, totalCss };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: (params) => {
    const { depth, leftEdge: leftCap, rightEdge: rightCap } = withDefaults(DEFAULTS, params);
    const left = resolveEdge(leftCap)(depth, INSETS_HEIGHT);
    const right = resolveEdge(rightCap)(depth, INSETS_HEIGHT);
    // Each side's (a) average offset, used to shift padding so text reads
    // centered in the visible silhouette (not the bounding rect), and (b)
    // deepest inward cut, the floor below which padding mustn't drop or text
    // would crash into the cap.
    const avgOffset = (edge: EdgePoint[]) => {
      let area = 0;
      for (let i = 1; i < edge.length; i++) {
        area += ((edge[i - 1].x + edge[i].x) / 2) * (edge[i].y - edge[i - 1].y);
      }
      return area / INSETS_HEIGHT;
    };
    const avgLeft = avgOffset(left);
    const avgRight = avgOffset(right);
    const maxLeftInward = Math.max(0, maxOf(left, (p) => p.x));
    const maxRightInward = Math.max(0, maxOf(right, (p) => -p.x));
    // Desired asymmetry: padLeft - padRight = avgLeft + avgRight (so the text
    // centroid sits at the silhouette's centroid). Hold padLeft + padRight = 2 * depth.
    const shift = (avgLeft + avgRight) / 2;
    const leftPad = Math.max(maxLeftInward, depth + shift);
    const rightPad = Math.max(maxRightInward, depth - shift);
    return { top: 0, right: rightPad, bottom: 0, left: leftPad };
  },
};

export default Powerline;
