import { describe, expect, it } from 'vitest';
import { alignMoveBehavior, alignInsertBehavior, alignResizeBehavior } from './behaviors';
import type { Guide } from '../types';
import type {
  GestureContext,
  GroupTransform,
  InsertProposed,
  ModifierState,
  ResizeAnchor,
  ResizePose,
} from 'interactions/gestures/types';

interface Pose { x: number; y: number; width: number; height: number }

function ctx(
  modifiers: Partial<ModifierState> = {},
  origin: Pose = { x: 100, y: 100, width: 50, height: 50 },
): GestureContext<Pose> {
  const o = new Map<string, Pose>();
  o.set('a', origin);
  return {
    draggedIds: ['a'],
    origin: o,
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...modifiers },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {} as never,
    scratch: {},
  };
}

const tt = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });

describe('alignMoveBehavior', () => {
  it('shapes the transform and publishes the active line on a hit', () => {
    const cands: Guide[] = [{ id: 'L', axis: 'x', offset: 96 }];
    let active: readonly Guide[] = [];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => cands,
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    // origin L=100; proposed translate (0,0) keeps L=100; candidate 96 within 5.
    const res = b.onMove!(ctx(), tt(0, 0));
    expect(res).toEqual({ transform: { kind: 'translate', dx: -4, dy: 0 } });
    expect(active).toEqual([{ id: 'L', axis: 'x', offset: 96 }]);
  });

  it('clears actives and returns nothing on a miss', () => {
    let active: readonly Guide[] = [{ id: 'stale', axis: 'x', offset: 0 }];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [{ id: 'L', axis: 'x', offset: 300 }],
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    expect(b.onMove!(ctx(), tt(0, 0))).toBeUndefined();
    expect(active).toEqual([]);
  });

  it('onEnd clears actives', () => {
    let active: readonly Guide[] = [{ id: 'x', axis: 'x', offset: 1 }];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [],
      setActiveGuides: (g) => { active = g; },
    });
    b.onEnd!(ctx());
    expect(active).toEqual([]);
  });

  it('bypassKey held skips matching and clears actives', () => {
    let active: readonly Guide[] = [{ id: 'x', axis: 'x', offset: 1 }];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [{ id: 'L', axis: 'x', offset: 100 }],
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
      bypassKey: 'alt',
    });
    expect(b.onMove!(ctx({ alt: true }), tt(0, 0))).toBeUndefined();
    expect(active).toEqual([]);
  });
});

describe('alignInsertBehavior', () => {
  it('snaps the live current point and publishes the line', () => {
    const cands: Guide[] = [{ id: 'gx', axis: 'x', offset: 200 }];
    let active: readonly Guide[] = [];
    const b = alignInsertBehavior<Pose>({
      getCandidates: () => cands,
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    const proposed: InsertProposed<Pose> = {
      start: { x: 50, y: 50 },
      current: { x: 197, y: 80 },
      bounds: { x: 50, y: 50, width: 147, height: 30 },
      pose: { x: 50, y: 50, width: 147, height: 30 },
    };
    const res = b.onMove!(ctx(), proposed);
    expect(res).toEqual({ current: { x: 200, y: 80 } });
    expect(active).toEqual([{ id: 'gx', axis: 'x', offset: 200 }]);
  });
});

describe('alignResizeBehavior', () => {
  it('snaps the moving east edge and pins the west edge', () => {
    const cands: Guide[] = [{ id: 'r', axis: 'x', offset: 152 }];
    let active: readonly Guide[] = [];
    const b = alignResizeBehavior<ResizePose>({
      getCandidates: () => cands,
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    const pose: ResizePose = { x: 100, y: 100, width: 50, height: 50 }; // R=150
    const anchor: ResizeAnchor = { x: 'min', y: 'free' }; // west pinned, east moves
    const res = b.onMove!(ctx(), { pose, anchor });
    // east edge 150 -> 152: width 50 -> 52, x unchanged.
    expect(res).toEqual({ pose: { x: 100, y: 100, width: 52, height: 50 } });
    expect(active).toEqual([{ id: 'r', axis: 'x', offset: 152 }]);
  });
});
