import { describe, expect, it } from 'vitest';
import {
  IDENTITY_POSE_COMPOSITION,
  RECT_POSE_COMPOSITION,
  RIGID_POSE_COMPOSITION,
  composeRigidPose,
  composeWorldPose,
  decomposeRigidPose,
  type PoseAdapter,
} from './composePose';
import type { RectPose } from 'core/scene/types';

/** The four corners a pose occupies in the frame it is expressed in:
 *  its unrotated box, turned about that box's own center. */
function corners(p: RectPose): [number, number][] {
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  const r = p.rotation ?? 0;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return ([[p.x, p.y], [p.x + p.width, p.y], [p.x + p.width, p.y + p.height], [p.x, p.y + p.height]] as const)
    .map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as [number, number]);
}

/** Ground truth, computed a different way than `composeRigidPose` does it:
 *  offset the child into the parent's unrotated box, then turn the whole thing
 *  about the parent's center. */
function cornersUnderParent(parent: RectPose, child: RectPose): [number, number][] {
  const pcx = parent.x + parent.width / 2;
  const pcy = parent.y + parent.height / 2;
  const pr = parent.rotation ?? 0;
  const c = Math.cos(pr);
  const s = Math.sin(pr);
  return corners({ ...child, x: child.x + parent.x, y: child.y + parent.y })
    .map(([x, y]) => [pcx + (x - pcx) * c - (y - pcy) * s, pcy + (x - pcx) * s + (y - pcy) * c] as [number, number]);
}

function maxCornerError(a: [number, number][], b: [number, number][]): number {
  return Math.max(...a.map(([x, y], i) => Math.hypot(x - b[i][0], y - b[i][1])));
}

const PARENT: RectPose = { x: 100, y: 40, width: 200, height: 120, rotation: 0.7 };
const CHILD: RectPose = { x: 15, y: 25, width: 60, height: 40, rotation: -0.3 };

describe('composeRigidPose', () => {
  it('puts the child where the parent frame puts its corners', () => {
    const world = composeRigidPose(PARENT, CHILD);
    expect(maxCornerError(corners(world), cornersUnderParent(PARENT, CHILD))).toBeLessThan(1e-9);
  });

  it('sums rotation and leaves the child size alone', () => {
    const world = composeRigidPose(PARENT, CHILD);
    expect(world.rotation).toBeCloseTo(0.4, 12);
    expect(world.width).toBe(60);
    expect(world.height).toBe(40);
  });

  it('reduces to translation when the parent is upright', () => {
    const upright: RectPose = { x: 100, y: 40, width: 200, height: 120 };
    expect(composeRigidPose(upright, CHILD)).toEqual({
      x: 115, y: 65, width: 60, height: 40, rotation: -0.3,
    });
  });

  it('treats an absent rotation as zero on either side', () => {
    const p: RectPose = { x: 10, y: 20, width: 5, height: 5 };
    const c: RectPose = { x: 1, y: 2, width: 3, height: 4 };
    expect(composeRigidPose(p, c)).toEqual({ x: 11, y: 22, width: 3, height: 4, rotation: 0 });
  });

  it('is what a rotated parent does to an upright child — the case that is wrong today', () => {
    // A child sitting at the parent's own origin, parent turned a quarter turn.
    // Under translation-only composition the child would stay upright at (100,40).
    const parent: RectPose = { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 };
    const child: RectPose = { x: 0, y: 0, width: 20, height: 10 };
    const world = composeRigidPose(parent, child);
    expect(world.rotation).toBeCloseTo(Math.PI / 2, 12);
    // Child center sits at parent-local (10,5), i.e. (-40,-45) from the parent's
    // center; a quarter turn sends that offset to (45,-40), so (95,10).
    expect(world.x + world.width / 2).toBeCloseTo(95, 9);
    expect(world.y + world.height / 2).toBeCloseTo(10, 9);
  });
});

describe('decomposeRigidPose', () => {
  it('inverts compose exactly', () => {
    const world = composeRigidPose(PARENT, CHILD);
    const back = decomposeRigidPose(PARENT, world);
    expect(back.x).toBeCloseTo(CHILD.x, 9);
    expect(back.y).toBeCloseTo(CHILD.y, 9);
    expect(back.rotation!).toBeCloseTo(CHILD.rotation!, 12);
    expect(back.width).toBe(CHILD.width);
    expect(back.height).toBe(CHILD.height);
  });

  it('round-trips over a spread of random parent/child pairs', () => {
    let worst = 0;
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return ((seed / 0x7fffffff) * 2 - 1) * n;
    };
    for (let i = 0; i < 2000; i++) {
      const p: RectPose = { x: rnd(300), y: rnd(300), width: 10 + Math.abs(rnd(200)), height: 10 + Math.abs(rnd(200)), rotation: rnd(Math.PI) };
      const c: RectPose = { x: rnd(150), y: rnd(150), width: 5 + Math.abs(rnd(80)), height: 5 + Math.abs(rnd(80)), rotation: rnd(Math.PI) };
      const back = decomposeRigidPose(p, composeRigidPose(p, c));
      worst = Math.max(worst, Math.hypot(back.x - c.x, back.y - c.y));
      // Corner agreement is the property that matters; rotation may differ by 2pi.
      worst = Math.max(worst, maxCornerError(corners(composeRigidPose(p, c)), cornersUnderParent(p, c)));
    }
    expect(worst).toBeLessThan(1e-6);
  });
});

describe('composition strategies declare their closure', () => {
  it('identity composes nothing and says so', () => {
    expect(IDENTITY_POSE_COMPOSITION.closure).toBe('identity');
  });

  it('the rect strategy is translation-only', () => {
    expect(RECT_POSE_COMPOSITION.closure).toBe('translation');
  });

  it('the rigid strategy composes rotation too', () => {
    expect(RIGID_POSE_COMPOSITION.closure).toBe('rigid');
  });
});

describe('composeWorldPose over a rigid chain', () => {
  it('folds two levels of rotation', () => {
    const scene: Record<string, { pose: RectPose; parent: string | null }> = {
      outer: { pose: { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 }, parent: null },
      inner: { pose: { x: 0, y: 0, width: 40, height: 40, rotation: Math.PI / 2 }, parent: 'outer' },
      leaf: { pose: { x: 0, y: 0, width: 10, height: 10 }, parent: 'inner' },
    };
    const adapter: PoseAdapter<RectPose> = {
      getPose: (id) => scene[id].pose,
      getParent: (id) => scene[id].parent,
    };
    const world = composeWorldPose(adapter, 'leaf', composeRigidPose);
    expect(world.rotation).toBeCloseTo(Math.PI, 12);
  });

  it('agrees with folding the chain by hand', () => {
    const scene: Record<string, { pose: RectPose; parent: string | null }> = {
      a: { pose: { x: 30, y: 10, width: 200, height: 100, rotation: 0.4 }, parent: null },
      b: { pose: { x: 20, y: 15, width: 90, height: 60, rotation: -0.25 }, parent: 'a' },
      c: { pose: { x: 5, y: 8, width: 20, height: 12, rotation: 0.1 }, parent: 'b' },
    };
    const adapter: PoseAdapter<RectPose> = {
      getPose: (id) => scene[id].pose,
      getParent: (id) => scene[id].parent,
    };
    const byWalk = composeWorldPose(adapter, 'c', composeRigidPose);
    const byHand = composeRigidPose(composeRigidPose(scene.a.pose, scene.b.pose), scene.c.pose);
    expect(maxCornerError(corners(byWalk), corners(byHand))).toBeLessThan(1e-9);
  });
});
