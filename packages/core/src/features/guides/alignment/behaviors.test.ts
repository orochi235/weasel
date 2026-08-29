import { describe, expect, it } from 'vitest';
import { alignMoveBehavior, alignInsertBehavior, alignResizeBehavior } from './behaviors';
import { deriveAlignmentGuides } from './derive';
import type { Guide } from '../types';
import type {
  GestureContext,
  GroupTransform,
  InsertProposed,
  ModifierState,
  ResizeAnchor,
  ResizePose,
} from 'interactions/gestures/types';

interface Pose { x: number; y: number; width: number; height: number; rotation?: number }

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

  it('matches the union box of a multi-id selection and returns one shared delta', () => {
    // Two dragged boxes: A at x∈[100,150], B at x∈[180,260]. Union L=100, R=260.
    const o = new Map<string, Pose>([
      ['a', { x: 100, y: 100, width: 50, height: 50 }],
      ['b', { x: 180, y: 100, width: 80, height: 50 }],
    ]);
    const c: GestureContext<Pose> = {
      draggedIds: ['a', 'b'], origin: o, current: new Map(), snap: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
      adapter: {} as never, scratch: {},
    };
    let active: readonly Guide[] = [];
    const b = alignMoveBehavior<Pose>({
      // candidate near the union's RIGHT edge (260) — neither box's own right edge.
      getCandidates: () => [{ id: 'ur', axis: 'x', offset: 262 }],
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    // proposed translate (0,0): union right = 260, candidate 262 → dx +2.
    expect(b.onMove!(c, tt(0, 0))).toEqual({ transform: { kind: 'translate', dx: 2, dy: 0 } });
    expect(active).toEqual([{ id: 'ur', axis: 'x', offset: 262 }]);
  });

  it('snaps the union center across two boxes', () => {
    const o = new Map<string, Pose>([
      ['a', { x: 100, y: 100, width: 40, height: 40 }],
      ['b', { x: 200, y: 100, width: 40, height: 40 }],
    ]);
    const c: GestureContext<Pose> = {
      draggedIds: ['a', 'b'], origin: o, current: new Map(), snap: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
      adapter: {} as never, scratch: {},
    };
    let active: readonly Guide[] = [];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [{ id: 'uc', axis: 'x', offset: 171 }], // union cx = (100+240)/2 = 170
      setActiveGuides: (g) => { active = g; },
      tolerance: 5,
    });
    expect(b.onMove!(c, tt(0, 0))).toEqual({ transform: { kind: 'translate', dx: 1, dy: 0 } });
    expect(active[0]!.id).toBe('uc');
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

describe('alignMoveBehavior with a rotated pose', () => {
  it('snaps by the ink extent, not the stored pose box', () => {
    // 40x10 turned a quarter turn: ink spans x 55..65, stored box x 40..80.
    const rotated: Pose = { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 };
    let active: readonly Guide[] = [];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => [{ id: 'L', axis: 'x', offset: 50 }],
      setActiveGuides: (g) => { active = g; },
      tolerance: 6,
    });
    // 50 is 5 from the ink's left edge (in tolerance) and 10 from the box's.
    const res = b.onMove!(ctx({}, rotated), tt(0, 0));
    expect(res).toEqual({ transform: { kind: 'translate', dx: -5, dy: 0 } });
    expect(active).toEqual([{ id: 'L', axis: 'x', offset: 50 }]);
  });

  it('matches a rotated selection against a rotated sibling, ink to ink', () => {
    // Sibling 40x10 at a quarter turn: ink x 55..65, stored box x 40..80.
    const sibling: Pose = { x: 40, y: 0, width: 40, height: 10, rotation: Math.PI / 2 };
    const dragged: Pose = { x: 100, y: 100, width: 40, height: 10, rotation: Math.PI / 2 };
    let active: readonly Guide[] = [];
    const b = alignMoveBehavior<Pose>({
      getCandidates: () => deriveAlignmentGuides([sibling]),
      setActiveGuides: (g) => { active = g; },
      tolerance: 6,
    });
    // Proposed dx -48 puts the dragged ink's left edge at 67, 2 short of the
    // sibling's ink right edge (65). The stored boxes would have matched a
    // different pair (52 against 55) and shifted the other way.
    const res = b.onMove!(ctx({}, dragged), tt(-48, 0));
    expect(res).toEqual({ transform: { kind: 'translate', dx: -50, dy: 0 } });
    expect(active.map((g) => g.offset)).toEqual([65]);
  });
});
