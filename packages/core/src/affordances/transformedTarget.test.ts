/**
 * Affordance regions on a target whose bounds carry a `transform`: a press
 * lands on a handle, the rotate ring, or the rotate badge where each is drawn
 * on the skewed shape, and the resize scratch names the corner that stays put
 * where the node draws it.
 */
import { describe, expect, it } from 'vitest';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { createCornerResizeAffordance, type CornerResizeScratch } from './cornerResize';
import { createRotationAffordance } from './rotationHandle';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import { hitAffordanceRegions } from './hitAffordanceRegions';
import { rotationHandle } from 'interactions/actions/rotate/handle';
import { asNodeId } from 'core/scene/types';
import type { ChromeState } from 'core/selection/chromeState';

const B = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6, transform: [1, 0, 0.8, 1] as const };
const VIEW = { x: 5, y: -3, scale: { x: 2, y: 2 } };
const DIMS = { width: 800, height: 600, dpr: 1 };
const FRAME = poseFrameOf(B)!;

const state = {
  selection: [asNodeId('a')],
  multiActive: false,
  boundsOf: () => B,
  unionBounds: null,
  modifiers: { shift: false, alt: false, meta: false, ctrl: false },
} as unknown as ChromeState;

/** A point of the unskewed box, where the node draws it. */
const drawn = (lx: number, ly: number) => {
  const [x, y] = applyToPoint(FRAME, lx, ly);
  return { x, y };
};

describe('corner handles on a skewed, turned target', () => {
  const corner = createCornerResizeAffordance({ handleHitRadius: 8 });
  const regionAt = (p: { x: number; y: number }) =>
    hitAffordanceRegions([corner], p.x, p.y, state, VIEW);

  it('takes a press on each corner as drawn', () => {
    expect(regionAt(drawn(0, 0))?.regionId).toBe('corner-min-min');
    expect(regionAt(drawn(100, 0))?.regionId).toBe('corner-max-min');
    expect(regionAt(drawn(0, 60))?.regionId).toBe('corner-min-max');
    expect(regionAt(drawn(100, 60))?.regionId).toBe('corner-max-max');
  });

  it('takes none where the corner would sit without the transform', () => {
    const turnedOnly = poseFrameOf({ ...B, transform: undefined })!;
    const [x, y] = applyToPoint(turnedOnly, 100, 60);
    expect(regionAt({ x, y })).toBeNull();
  });

  it('names the fixed corner where the node draws it', () => {
    const hit = regionAt(drawn(100, 60))!;
    const scratch = hit.binding.initialScratch as CornerResizeScratch;
    const tl = drawn(0, 0);
    expect(scratch.fixedPoint.x).toBeCloseTo(tl.x, 6);
    expect(scratch.fixedPoint.y).toBeCloseTo(tl.y, 6);
  });

  it('paints each handle on the corner it is grabbed at', () => {
    const layer = composeAffordanceLayer('chrome', 'Chrome', [corner]);
    const cmds = layer.draw(state, VIEW, DIMS) as PathDrawCommand[];
    const centers = cmds.map((c) => {
      const q = (c.path as { coords: ArrayLike<number> }).coords;
      return { x: (q[0] + q[4]) / 2, y: (q[1] + q[5]) / 2 };
    });
    [drawn(0, 0), drawn(100, 0), drawn(0, 60), drawn(100, 60)].forEach((w, i) => {
      expect(centers[i].x).toBeCloseTo((w.x - VIEW.x) * VIEW.scale.x, 3);
      expect(centers[i].y).toBeCloseTo((w.y - VIEW.y) * VIEW.scale.y, 3);
    });
  });
});

describe('the rotate ring and badge on a skewed, turned target', () => {
  const rotate = createRotationAffordance({ bandPx: 24, handle: { distancePx: 24, hitRadiusPx: 8 } });
  const regionAt = (p: { x: number; y: number }) =>
    hitAffordanceRegions([rotate], p.x, p.y, state, VIEW)?.regionId ?? null;

  // Each point is on the other side of the unskewed box's edge.
  it('leaves the drawn body alone, out to its skewed edges', () => {
    expect(regionAt(drawn(50, 30))).toBeNull();
    expect(regionAt(drawn(90, 50))).toBeNull();
    expect(regionAt(drawn(10, 10))).toBeNull();
  });

  it('takes a press just outside a skewed edge', () => {
    expect(regionAt(drawn(-3, 55))).toBe('selection.rotation-handle');
    expect(regionAt(drawn(103, 5))).toBe('selection.rotation-handle');
  });

  it('takes the badge where the overlay paints it', () => {
    const h = rotationHandle(B, 24, VIEW.scale);
    expect(regionAt({ x: h.cx, y: h.cy })).toBe('rotation-badge');
    expect(regionAt({ x: h.cx + 3.5, y: h.cy })).toBe('rotation-badge');
  });
});

describe('a target whose transform is singular', () => {
  const flat = { ...B, transform: [1, 0, 0, 0] as const };
  const flatState = { ...state, boundsOf: () => flat } as unknown as ChromeState;

  it('has no ring to press: it draws nothing', () => {
    const rotate = createRotationAffordance({ bandPx: 24 });
    const [x, y] = applyToPoint(poseFrameOf({ ...B, transform: undefined })!, -3, 30);
    expect(hitAffordanceRegions([rotate], x, y, flatState, VIEW)).toBeNull();
  });
});

describe('the debug hitbox of a region on a skewed, turned target', () => {
  it('is the quad the region lands on, not a turned rect', () => {
    const shapes: Array<{ kind: string; points?: { x: number; y: number }[] }> = [];
    const rotate = createRotationAffordance({ bandPx: 0 });
    composeAffordanceLayer('chrome', 'Chrome', [rotate]).draw({
      getChromeState: () => state,
      getDebug: () => ({ recordHitbox: (_id: string, _role: string, shape: never) => { shapes.push(shape); } }),
    } as never, VIEW, DIMS);
    expect(shapes).toHaveLength(1);
    expect(shapes[0].kind).toBe('polygon');
    // The ring's outer ellipse has semi-axes of half the box times root two.
    const rx = 50 * Math.SQRT2, ry = 30 * Math.SQRT2;
    const want = [drawn(50 - rx, 30 - ry), drawn(50 + rx, 30 - ry), drawn(50 + rx, 30 + ry), drawn(50 - rx, 30 + ry)];
    want.forEach((w, i) => {
      expect(shapes[0].points![i].x).toBeCloseTo(w.x, 6);
      expect(shapes[0].points![i].y).toBeCloseTo(w.y, 6);
    });
  });
});
