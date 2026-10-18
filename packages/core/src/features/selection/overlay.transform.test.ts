/**
 * Selection chrome on a target whose pose carries a `transform`: the outline,
 * the handles, and the rotate badge land on the shape as `poseFrameOf` draws
 * it, not on its unskewed box.
 */
import { describe, expect, it } from 'vitest';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import { createSelectionOverlayLayer } from './overlay';
import { rotationHandle } from 'interactions/actions/rotate/handle';
import { asNodeId } from 'core/scene/types';
import type { RectPose } from 'core/scene/types';

const SKEWED: RectPose = { x: 0, y: 0, width: 100, height: 40, transform: [1, 0, 0.5, 1] };
const TURNED: RectPose = { ...SKEWED, rotation: Math.PI / 6 };
const VIEW = { x: 5, y: -3, scale: { x: 2, y: 2 } };
const DIMS = { width: 800, height: 600 };

/** The pose's box corners as drawn, on screen, TL/TR/BR/BL. */
function drawnCorners(pose: RectPose): { x: number; y: number }[] {
  const frame = poseFrameOf(pose)!;
  return [
    [pose.x, pose.y], [pose.x + pose.width, pose.y],
    [pose.x + pose.width, pose.y + pose.height], [pose.x, pose.y + pose.height],
  ].map(([lx, ly]) => {
    const [wx, wy] = applyToPoint(frame, lx, ly);
    return { x: (wx - VIEW.x) * VIEW.scale.x, y: (wy - VIEW.y) * VIEW.scale.y };
  });
}

function leaves(cmds: readonly DrawCommand[]): PathDrawCommand[] {
  return cmds.flatMap((c) => c.kind === 'group' ? leaves((c as GroupDrawCommand).children) : [c as PathDrawCommand]);
}

describe.each([['skewed', SKEWED], ['skewed and turned', TURNED]] as const)('chrome on a %s target', (_, pose) => {
  it('traces the outline through the corners the node is drawn at', () => {
    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => pose,
      handles: false,
      outline: { paint: { kind: 'solid', color: '#000' }, width: 2, pad: 0 },
    });
    const cmd = layer.draw(undefined, VIEW, DIMS)[0] as PathDrawCommand;
    expect(cmd.path.kind).toBe('polygon');
    const c = (cmd.path as { coords: ArrayLike<number> }).coords;
    drawnCorners(pose).forEach((p, i) => {
      expect(c[i * 2]).toBeCloseTo(p.x, 3);
      expect(c[i * 2 + 1]).toBeCloseTo(p.y, 3);
    });
  });

  it('centers a handle on each drawn corner', () => {
    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => pose,
      outline: { paint: { kind: 'solid', color: '#000' }, width: 2, pad: 0 },
      handles: { size: 8 },
      edgeHandles: false,
    });
    const tree = layer.draw(undefined, VIEW, DIMS);
    // Handle fills, in `RESIZE_HANDLE_ANCHORS` order: TL, TR, BL, BR.
    const centers = tree.slice(1).map((c) => {
      const fill = (c.kind === 'group' ? (c as GroupDrawCommand).children[0] : c) as PathDrawCommand;
      const r = fill.path as { x: number; y: number; width: number; height: number };
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).filter((_, i, all) => all.length === 4 || i % 2 === 0);
    const [tl, tr, br, bl] = drawnCorners(pose);
    [tl, tr, bl, br].forEach((p, i) => {
      expect(centers[i].x).toBeCloseTo(p.x, 3);
      expect(centers[i].y).toBeCloseTo(p.y, 3);
    });
  });

  it('floats the rotate badge off the drawn top edge, square to it', () => {
    const DIST = 24;
    const h = rotationHandle(pose, DIST, VIEW.scale);
    const H = { x: (h.cx - VIEW.x) * VIEW.scale.x, y: (h.cy - VIEW.y) * VIEW.scale.y };
    const [a, b, c2, d] = drawnCorners(pose);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ex = b.x - a.x, ey = b.y - a.y;
    const dx = H.x - mx, dy = H.y - my;
    expect(Math.hypot(dx, dy)).toBeCloseTo(DIST, 6);
    expect((dx * ex + dy * ey) / Math.hypot(ex, ey)).toBeCloseTo(0, 6);
    // Outward: away from the opposite edge.
    expect(dx * (mx - (c2.x + d.x) / 2) + dy * (my - (c2.y + d.y) / 2)).toBeGreaterThan(0);

    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => pose,
      handles: { size: 8 },
      rotationHandle: { distance: DIST },
    });
    const tree = layer.draw(undefined, VIEW, DIMS);
    const badge = tree[tree.length - 1] as GroupDrawCommand;
    expect(badge.transform![6]).toBeCloseTo(H.x, 4);
    expect(badge.transform![7]).toBeCloseTo(H.y, 4);
    expect(leaves([badge])).toHaveLength(3);
  });
});
