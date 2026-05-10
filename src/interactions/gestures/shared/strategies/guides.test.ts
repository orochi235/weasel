import { describe, expect, it } from 'vitest';
import { guideSnapStrategy } from './guides';
import type { Guide } from '../../../../features/guides/types';
import type { GestureContext } from '../../types';

interface Pose { x: number; y: number }

const dummyCtx = {} as unknown as GestureContext<Pose>;

describe('guideSnapStrategy', () => {
  it('returns null when there are no guides', () => {
    const s = guideSnapStrategy<Pose>(() => []);
    expect(s.snap({ x: 10, y: 20 }, dummyCtx)).toBeNull();
  });

  it('snaps within tolerance to a single x guide', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const s = guideSnapStrategy<Pose>(() => guides, { tolerance: 5 });
    expect(s.snap({ x: 102, y: 50 }, dummyCtx)).toEqual({ x: 100, y: 50 });
  });

  it('returns null when outside tolerance', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const s = guideSnapStrategy<Pose>(() => guides, { tolerance: 5 });
    expect(s.snap({ x: 110, y: 50 }, dummyCtx)).toBeNull();
  });

  it('closest of multiple guides on the same axis wins', () => {
    const guides: Guide[] = [
      { id: 'a', axis: 'x', offset: 100 },
      { id: 'b', axis: 'x', offset: 105 },
    ];
    const s = guideSnapStrategy<Pose>(() => guides, { tolerance: 10 });
    // 103 is 3 from 100 and 2 from 105 → 105 wins.
    expect(s.snap({ x: 103, y: 0 }, dummyCtx)).toEqual({ x: 105, y: 0 });
  });

  it('snaps independently on x and y when both are within range', () => {
    const guides: Guide[] = [
      { id: 'vx', axis: 'x', offset: 100 },
      { id: 'hy', axis: 'y', offset: 200 },
    ];
    const s = guideSnapStrategy<Pose>(() => guides, { tolerance: 5 });
    expect(s.snap({ x: 102, y: 198 }, dummyCtx)).toEqual({ x: 100, y: 200 });
  });

  it('snaps only the in-range axis when the other is out of range', () => {
    const guides: Guide[] = [
      { id: 'vx', axis: 'x', offset: 100 },
      { id: 'hy', axis: 'y', offset: 200 },
    ];
    const s = guideSnapStrategy<Pose>(() => guides, { tolerance: 5 });
    expect(s.snap({ x: 102, y: 250 }, dummyCtx)).toEqual({ x: 100, y: 250 });
  });

  it('preserves extra pose fields (rect-shaped TPose)', () => {
    interface FullPose { x: number; y: number; width: number; height: number }
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 50 }];
    const s = guideSnapStrategy<FullPose>(() => guides, { tolerance: 5 });
    expect(
      s.snap({ x: 52, y: 10, width: 4, height: 8 }, dummyCtx as unknown as GestureContext<FullPose>),
    ).toEqual({ x: 50, y: 10, width: 4, height: 8 });
  });

  it('treats tolerance as world units when no view is given', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const s = guideSnapStrategy<Pose>(() => guides, { tolerance: 6 });
    // 6 world units away — exactly on the boundary. Allowed.
    expect(s.snap({ x: 106, y: 0 }, dummyCtx)).toEqual({ x: 100, y: 0 });
    // 7 world units away — outside.
    expect(s.snap({ x: 107, y: 0 }, dummyCtx)).toBeNull();
  });

  it('scales tolerance from screen px through getView', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    // tolerance = 6 px, scale = 2 → world tolerance = 3.
    const s = guideSnapStrategy<Pose>(() => guides, {
      tolerance: 6,
      getView: () => ({ x: 0, y: 0, scale: 2 }),
    });
    expect(s.snap({ x: 103, y: 0 }, dummyCtx)).toEqual({ x: 100, y: 0 });
    expect(s.snap({ x: 104, y: 0 }, dummyCtx)).toBeNull();
  });

  it('zoomed-out view (scale 0.5) widens the world trigger zone', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    // tolerance = 6 px, scale = 0.5 → world tolerance = 12.
    const s = guideSnapStrategy<Pose>(() => guides, {
      tolerance: 6,
      getView: () => ({ x: 0, y: 0, scale: 0.5 }),
    });
    expect(s.snap({ x: 110, y: 0 }, dummyCtx)).toEqual({ x: 100, y: 0 });
    expect(s.snap({ x: 113, y: 0 }, dummyCtx)).toBeNull();
  });

  it('returns null when pose origin is exactly on the guide (no movement)', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const s = guideSnapStrategy<Pose>(() => guides);
    expect(s.snap({ x: 100, y: 0 }, dummyCtx)).toBeNull();
  });

  it('respects an OriginProjection for non-rect TPose', () => {
    interface PathPose { points: Array<{ x: number; y: number }> }
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 50 }];
    const s = guideSnapStrategy<PathPose>(() => guides, {
      tolerance: 5,
      origin: {
        getOrigin: (p) => p.points[0],
        translate: (p, dx, dy) => ({
          points: p.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
        }),
      },
    });
    const out = s.snap(
      { points: [{ x: 52, y: 10 }, { x: 60, y: 10 }] },
      dummyCtx as unknown as GestureContext<PathPose>,
    );
    expect(out).toEqual({ points: [{ x: 50, y: 10 }, { x: 58, y: 10 }] });
  });
});
