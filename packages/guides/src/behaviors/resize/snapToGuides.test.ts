import { describe, expect, it } from 'vitest';
import { createKitSettingsStore } from '@weasel-js/react';
import { snapToGuides } from './snapToGuides';
import type { Guide } from '../../guides/types';
import type {
  GestureContext,
  ModifierState,
  ResizeAnchor,
  ResizeProposed,
  Bounds,
} from '@weasel-js/core';

type P = Bounds;

function ctx(
  origin: P,
  mods: Partial<ModifierState> = {},
  view: GestureContext<P>['view'] = null,
): GestureContext<P> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', origin]]),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...mods },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    view,
    adapter: {} as never,
    scratch: {},
  };
}

function proposed(pose: P, anchor: ResizeAnchor): ResizeProposed<P> {
  return { pose, anchor };
}

describe('resize/snapToGuides', () => {
  it('reads its tolerance from targets.guideSnapPx on the gesture', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({ getGuides: () => guides });
    const c = { ...ctx({ x: 0, y: 0, width: 50, height: 50 }), kitSettings: createKitSettingsStore({ targets: { guideSnapPx: 20 } }) };
    const r = b.onMove!(c, proposed({ x: 0, y: 0, width: 115, height: 50 }, { x: 'min', y: 'free' }));
    expect(r).toEqual({ pose: { x: 0, y: 0, width: 100, height: 50 } });
  });

  it('snaps east edge to a vertical guide (anchor=min)', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 0, width: 102, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(r).toEqual({ pose: { x: 0, y: 0, width: 100, height: 50 } });
  });

  it('snaps west edge to a vertical guide (anchor=max)', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 20 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    // origin: x=0, width=100 → east at 100 (pinned). proposed x=22, width=78.
    // Want west to snap to 20 → x=20, width=80.
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 100, height: 50 }),
      proposed({ x: 22, y: 0, width: 78, height: 50 }, { x: 'max', y: 'free' }),
    );
    expect(r).toEqual({ pose: { x: 20, y: 0, width: 80, height: 50 } });
  });

  it('snaps both axes for a corner drag', () => {
    const guides: Guide[] = [
      { id: 'vx', axis: 'x', offset: 100 },
      { id: 'hy', axis: 'y', offset: 50 },
    ];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 80, height: 30 }),
      proposed({ x: 0, y: 0, width: 102, height: 48 }, { x: 'min', y: 'min' }),
    );
    expect(r).toEqual({ pose: { x: 0, y: 0, width: 100, height: 50 } });
  });

  it('free axis is never snapped', () => {
    const guides: Guide[] = [{ id: 'hy', axis: 'y', offset: 50 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    // anchor.y = free → y axis untouched even though guide is in range.
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 48, width: 50, height: 50 }, { x: 'free', y: 'free' }),
    );
    expect(r).toBeUndefined();
  });

  it('out of tolerance → no result', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 0, width: 110, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(r).toBeUndefined();
  });

  it('bypassKey suppresses snapping', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    const b = snapToGuides<P>({
      getGuides: () => guides,
      tolerance: 5,
      bypassKey: 'alt',
    });
    const r = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }, { alt: true }),
      proposed({ x: 0, y: 0, width: 102, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(r).toBeUndefined();
  });

  it('view scaling: tolerance shrinks when zoomed in', () => {
    const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }];
    // 6 px / scale 2 → 3 world units of tolerance.
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 6 });
    const zoomed = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    // 3 world units away — snaps.
    const a = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }, {}, zoomed),
      proposed({ x: 0, y: 0, width: 103, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(a).toEqual({ pose: { x: 0, y: 0, width: 100, height: 50 } });
    // 4 world units away — outside.
    const c = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }, {}, zoomed),
      proposed({ x: 0, y: 0, width: 104, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(c).toBeUndefined();
  });
});

// The poses are in a plane whose world is the camera's doubled and shifted:
// plane = 2 * camera + 10 on x, 2 * camera on y.
const plane = { scale: { x: 2, y: 2 }, offset: { x: 10, y: 0 } };

describe('resize/snapToGuides on a parallax plane', () => {
  const guides: Guide[] = [{ id: 'g', axis: 'x', offset: 100 }, { id: 'h', axis: 'y', offset: 40 }];
  const onPlane = (origin: P) => ({ ...ctx(origin), plane });

  it('snaps the moving edge to where the camera\'s guide lies in the plane', () => {
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    // Camera x=100 is plane 210; camera y=40 is plane 80.
    const r = b.onMove!(
      onPlane({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 0, width: 209, height: 82 }, { x: 'min', y: 'min' }),
    );
    expect(r).toEqual({ pose: { x: 0, y: 0, width: 210, height: 80 } });
  });

  it('does not snap to the guide\'s camera coordinate read as a plane one', () => {
    const b = snapToGuides<P>({ getGuides: () => guides, tolerance: 5 });
    const r = b.onMove!(
      onPlane({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 0, width: 101, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(r).toBeUndefined();
  });
});
