import { describe, expect, it } from 'vitest';
import type { Bounds, GestureContext, GroupTransform, PlaneMap, ResizeAnchor } from '@weasel-js/core';
import { alignInsertBehavior, alignMoveBehavior, alignResizeBehavior } from './behaviors';
import { deriveAlignmentGuides } from './derive';
import type { AlignmentBehaviorBase } from './types';
import type { Guide, SpacingGap } from '../types';

type Pose = Bounds;

// plane = 2 * camera + 10 on x, 2 * camera - 6 on y.
const plane: PlaneMap = { scale: { x: 2, y: 2 }, offset: { x: 10, y: -6 } };
const toPlane = (b: Bounds): Bounds => ({ x: 2 * b.x + 10, y: 2 * b.y - 6, width: 2 * b.width, height: 2 * b.height });

function ctx(origin: Pose, onPlane: boolean): GestureContext<Pose> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', origin]]),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view: null,
    plane: onPlane ? plane : null,
    adapter: {} as never,
    scratch: {},
  };
}

/** What a behavior published, and the args that record it. The tolerance is
 *  in the gesture's world, so the plane's is twice the camera's. */
function recorded(onPlane: boolean, extra: Partial<AlignmentBehaviorBase>) {
  const seen: { guides: readonly Guide[]; gaps: readonly SpacingGap[] } = { guides: [], gaps: [] };
  const args: AlignmentBehaviorBase = {
    getCandidates: () => [],
    setActiveGuides: (g) => { seen.guides = g; },
    setActiveGaps: (g) => { seen.gaps = g; },
    tolerance: onPlane ? 6 : 3,
    ...extra,
  };
  return { seen, args };
}

// Everything the caller hands over is in the camera's world.
const LINE: Guide = { id: 'L', axis: 'x', offset: 48, span: { min: 0, max: 20 } };
const ROW: Bounds[] = [{ x: 0, y: 50, width: 10, height: 25 }, { x: 20, y: 50, width: 10, height: 25 }];
const BOX: Bounds = { x: 50, y: 50, width: 25, height: 25 };

describe('alignment snapping on a parallax plane', () => {
  it('moves a plane pose onto a camera line, and publishes the line where the camera draws it', () => {
    const flat = recorded(false, { getCandidates: () => [LINE] });
    const deep = recorded(true, { getCandidates: () => [LINE] });
    const onFlat = alignMoveBehavior<Pose>(flat.args).onMove!(ctx(BOX, false), { kind: 'translate', dx: 0, dy: 0 });
    const onDeep = alignMoveBehavior<Pose>(deep.args).onMove!(ctx(toPlane(BOX), true), { kind: 'translate', dx: 0, dy: 0 });

    expect(onFlat).toEqual({ transform: { kind: 'translate', dx: -2, dy: 0 } });
    expect(onDeep).toEqual({ transform: { kind: 'translate', dx: -4, dy: 0 } });
    expect(deep.seen.guides).toEqual(flat.seen.guides);
    expect(deep.seen.guides).toEqual([{ ...LINE, span: { min: 0, max: 75 } }]);
  });

  it('measures equal gaps against camera boxes, and publishes the markers in the camera\'s world', () => {
    const move: GroupTransform = { kind: 'translate', dx: -9, dy: 0 };
    const flat = recorded(false, { getSpacingTargets: () => ROW });
    const deep = recorded(true, { getSpacingTargets: () => ROW });
    const onFlat = alignMoveBehavior<Pose>(flat.args).onMove!(ctx(BOX, false), move);
    const onDeep = alignMoveBehavior<Pose>(deep.args)
      .onMove!(ctx(toPlane(BOX), true), { kind: 'translate', dx: -18, dy: 0 });

    expect(onFlat).toEqual({ transform: { kind: 'translate', dx: -10, dy: 0 } });
    expect(onDeep).toEqual({ transform: { kind: 'translate', dx: -20, dy: 0 } });
    expect(flat.seen.gaps).toHaveLength(2);
    expect(deep.seen.gaps).toEqual(flat.seen.gaps);
  });

  it('snaps an inserted point to a camera line', () => {
    const deep = recorded(true, { getCandidates: () => [LINE] });
    const res = alignInsertBehavior<Pose>(deep.args)
      .onMove!(ctx(toPlane(BOX), true), { start: { x: 0, y: 0 }, current: { x: 103, y: 40 } } as never);
    expect(res).toEqual({ current: { x: 106, y: 40 } });
    expect(deep.seen.guides.map((g) => [g.id, g.offset])).toEqual([['L', 48]]);
  });

  it('snaps a resized edge to a camera line', () => {
    const deep = recorded(true, { getCandidates: () => [{ id: 'R', axis: 'x', offset: 77 }] });
    const pose = toPlane(BOX);
    const anchor: ResizeAnchor = { x: 'min', y: 'free' };
    const res = alignResizeBehavior<Pose>(deep.args).onMove!(ctx(pose, true), { pose, anchor } as never);
    // The east edge is at 160 in the plane; the line is at 2 * 77 + 10 = 164.
    expect(res).toEqual({ pose: { ...pose, width: 54 } });
    expect(deep.seen.guides).toEqual([{ id: 'R', axis: 'x', offset: 77 }]);
  });
});

describe('deriveAlignmentGuides for siblings on a plane', () => {
  it('carries each box out of the plane it says it is in', () => {
    const sibling = toPlane({ x: 40, y: 10, width: 20, height: 30 });
    const lines = deriveAlignmentGuides([sibling], { planeOf: () => plane, centers: false });
    expect(lines.map((g) => [g.axis, g.offset, g.span])).toEqual([
      ['x', 40, { min: 10, max: 40 }],
      ['x', 60, { min: 10, max: 40 }],
      ['y', 10, { min: 40, max: 60 }],
      ['y', 40, { min: 40, max: 60 }],
    ]);
  });

  it('reads a box with no plane, and the page, as camera coordinates', () => {
    const box = { x: 40, y: 10, width: 20, height: 30 };
    const withPlane = deriveAlignmentGuides([box], { planeOf: () => null, page: box });
    expect(withPlane).toEqual(deriveAlignmentGuides([box], { page: box }));
  });
});
