/**
 * The rotate badge under non-uniform zoom on a rotated selection.
 *
 * It sits a fixed number of screen pixels off the top edge, along that edge's
 * normal as it lands on screen, and the painted glyph, the grab region and the
 * slops overlay all put it in the same place.
 */
import { describe, expect, it } from 'vitest';
import type { GroupDrawCommand, PathDrawCommand } from '../../renderer';
import { createSelectionOverlayLayer } from './overlay';
import { createRotationAffordance } from 'affordances/rotationHandle';
import { hitAffordanceRegions } from 'affordances/hitAffordanceRegions';
import { createSlopsDebugLayer } from 'canvas/slopsDebugLayer';
import { rotationHandle } from 'interactions/actions/rotate/handle';
import { rotatePoint } from 'interactions/actions/rotate/geometry';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen, screenToWorld } from 'core/viewport/viewTransform';
import { asNodeId } from 'core/scene/types';
import type { ChromeState } from 'core/selection/chromeState';

const B = { x: 10, y: 20, width: 40, height: 20, rotation: Math.PI / 6 };
const VIEW = { x: 5, y: -3, scale: { x: 4, y: 1 } };
const DIST = 24;
const SIZE = 8;
const DIMS = { width: 800, height: 600 };
const T = viewToTransform(VIEW);

const state = {
  selection: [asNodeId('a')],
  multiActive: false,
  boundsOf: () => B,
  unionBounds: null,
  modifiers: { shift: false, alt: false, meta: false, ctrl: false },
} as unknown as ChromeState;
const envelope = { getChromeState: () => state };

const toScreen = (p: { x: number; y: number }) => {
  const [x, y] = worldToScreen(p.x, p.y, T);
  return { x, y };
};
const toWorld = (p: { x: number; y: number }) => {
  const [x, y] = screenToWorld(p.x, p.y, T);
  return { x, y };
};

/** The top edge's screen endpoints and the selection's screen center. */
function topEdgeOnScreen() {
  const cx = B.x + B.width / 2, cy = B.y + B.height / 2;
  const a = toScreen(rotatePoint(B.x, B.y, cx, cy, B.rotation));
  const b = toScreen(rotatePoint(B.x + B.width, B.y, cx, cy, B.rotation));
  return { a, b, c: toScreen({ x: cx, y: cy }) };
}

describe('rotate badge under 4:1 zoom on a rotated selection', () => {
  const h = rotationHandle(B, DIST, VIEW.scale);
  const H = toScreen({ x: h.cx, y: h.cy });

  it('sits DIST screen px off the top edge, along its on-screen normal', () => {
    const { a, b, c } = topEdgeOnScreen();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ex = b.x - a.x, ey = b.y - a.y;
    const dx = H.x - mx, dy = H.y - my;
    expect(Math.hypot(dx, dy)).toBeCloseTo(DIST, 6);
    expect((dx * ex + dy * ey) / Math.hypot(ex, ey)).toBeCloseTo(0, 6);
    // Outward: away from the center.
    expect(dx * (mx - c.x) + dy * (my - c.y)).toBeGreaterThan(0);
  });

  it('is painted where it sits, turned to the edge it sits on', () => {
    const layer = createSelectionOverlayLayer({
      getSelection: () => [asNodeId('a')],
      handles: { size: SIZE },
      rotationHandle: { distance: DIST },
    });
    const tree = layer.draw(envelope, VIEW, DIMS);
    const badge = tree[tree.length - 1] as GroupDrawCommand;
    expect(badge.kind).toBe('group');
    const m = badge.transform!;
    expect(m[6]).toBeCloseTo(H.x, 4);
    expect(m[7]).toBeCloseTo(H.y, 4);
    // Its local x axis runs along the edge as it lands on screen.
    const { a, b } = topEdgeOnScreen();
    const ex = b.x - a.x, ey = b.y - a.y;
    const l = Math.hypot(ex, ey);
    expect(m[0]).toBeCloseTo(ex / l, 4);
    expect(m[1]).toBeCloseTo(ey / l, 4);
  });

  it('is grabbable exactly where it is painted', () => {
    const aff = createRotationAffordance({
      paint: null,
      handle: { distancePx: DIST, hitRadiusPx: SIZE },
    });
    const at = (sx: number, sy: number) => {
      const w = toWorld({ x: H.x + sx, y: H.y + sy });
      return hitAffordanceRegions([aff], w.x, w.y, state, VIEW)?.regionId ?? null;
    };
    for (const [sx, sy] of [[0, 0], [SIZE - 0.5, 0], [-(SIZE - 0.5), 0], [0, -(SIZE - 0.5)]]) {
      expect(at(sx, sy)).toBe('rotation-badge');
    }
    expect(at(SIZE + 0.5, 0)).not.toBe('rotation-badge');
    expect(at(0, -(SIZE + 0.5))).not.toBe('rotation-badge');
  });

  it('shows its slop where it is grabbable', () => {
    const layer = createSlopsDebugLayer({
      getEditingId: () => null,
      getPose: () => null,
      rotationBadge: { distancePx: DIST, sizePx: SIZE },
    });
    const tree = layer.draw(envelope, VIEW, DIMS);
    const slop = tree[tree.length - 1] as PathDrawCommand;
    const c = slop.path.kind === 'rect'
      ? { x: slop.path.x + slop.path.width / 2, y: slop.path.y + slop.path.height / 2 }
      : null;
    expect(c).not.toBeNull();
    expect(c!.x).toBeCloseTo(H.x, 4);
    expect(c!.y).toBeCloseTo(H.y, 4);
  });
});
