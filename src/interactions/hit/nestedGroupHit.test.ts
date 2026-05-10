import { describe, it, expect } from 'vitest';
import { nestedGroupHitTester } from './nestedGroupHit';
import { composeRectPose } from 'features/groups/composePose';

interface Node {
  id: string;
  parent: string | null;
  pose: { x: number; y: number; width: number; height: number };
  isGroup?: boolean;
}

// g1 (root group) at world (40,40,230,150)
//   a    (leaf) local (10,10,60,50)   → world (50,50,60,50)
//   g2   (subgroup) local (85,45,130,90) → world (125,85,130,90)
//     b1 (leaf) local (8,8,50,35)     → world (133,93,50,35)
const NODES: Node[] = [
  { id: 'g1', parent: null, pose: { x: 40, y: 40, width: 230, height: 150 }, isGroup: true },
  { id: 'a',  parent: 'g1', pose: { x: 10, y: 10, width: 60, height: 50 } },
  { id: 'g2', parent: 'g1', pose: { x: 85, y: 45, width: 130, height: 90 }, isGroup: true },
  { id: 'b1', parent: 'g2', pose: { x: 8, y: 8, width: 50, height: 35 } },
];

const adapter = {
  getObject: (id: string) => NODES.find((n) => n.id === id),
  getObjects: () => NODES,
  getPose: (id: string) => NODES.find((n) => n.id === id)!.pose,
  getParent: (id: string) => NODES.find((n) => n.id === id)?.parent ?? null,
};

const tester = nestedGroupHitTester(adapter, {
  composePose: composeRectPose,
  isGroup: (_id, obj) => obj?.isGroup === true,
});

describe('nestedGroupHitTester', () => {
  it('pickOutermost returns outermost ancestor for a leaf hit', () => {
    expect(tester.pickOutermost(60, 60)).toBe('g1'); // hits leaf 'a', resolves to g1
    expect(tester.pickOutermost(140, 100)).toBe('g1'); // hits b1 → g1 (outermost)
  });

  it('pickOutermost returns null on empty space', () => {
    expect(tester.pickOutermost(0, 0)).toBeNull();
    expect(tester.pickOutermost(500, 500)).toBeNull();
  });

  it('pickOutermost skips group bodies (no leaf under cursor → null)', () => {
    // (45,45) is inside g1 but not inside any leaf — should miss.
    expect(tester.pickOutermost(45, 45)).toBeNull();
  });

  it('pickBest without alt matches pickOutermost (outermost)', () => {
    expect(tester.pickBest(140, 100, false, [])).toBe('g1');
    expect(tester.pickBest(140, 100, false, ['g2'])).toBe('g1');
  });

  it('pickBest with alt + empty selection drills to leaf', () => {
    expect(tester.pickBest(140, 100, true, [])).toBe('b1');
    expect(tester.pickBest(60, 60, true, [])).toBe('a');
  });

  it('pickBest with alt steps one level deeper than deepest selected ancestor', () => {
    // chain over b1 is [g1, g2, b1]. With g1 selected → step to g2.
    expect(tester.pickBest(140, 100, true, ['g1'])).toBe('g2');
    // With g2 selected → step to b1.
    expect(tester.pickBest(140, 100, true, ['g2'])).toBe('b1');
    // With b1 selected (already deepest) → stay at b1.
    expect(tester.pickBest(140, 100, true, ['b1'])).toBe('b1');
  });

  it('pickBest returns null on empty space', () => {
    expect(tester.pickBest(0, 0, false, [])).toBeNull();
    expect(tester.pickBest(0, 0, true, ['g1'])).toBeNull();
  });

  it('uses provided poseBounds for non-rect poses', () => {
    interface CirclePose { cx: number; cy: number; r: number }
    const cnodes = [
      { id: 'c', parent: null, pose: { cx: 100, cy: 100, r: 20 } },
    ];
    const t = nestedGroupHitTester(
      {
        getObject: (id) => cnodes.find((n) => n.id === id),
        getObjects: () => cnodes,
        getPose: (id) => cnodes.find((n) => n.id === id)!.pose,
        getParent: () => null,
      },
      {
        composePose: (_parent: CirclePose, child: CirclePose) => child,
        poseBounds: (p: CirclePose) => ({ x: p.cx - p.r, y: p.cy - p.r, width: p.r * 2, height: p.r * 2 }),
      },
    );
    expect(t.pickOutermost(100, 100)).toBe('c');
    expect(t.pickOutermost(150, 100)).toBeNull();
  });
});
