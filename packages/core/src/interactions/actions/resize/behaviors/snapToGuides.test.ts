import { describe, expect, it } from 'vitest';
import { snapToGuides } from './snapToGuides';
import type { Guide } from 'features/guides/types';
import type {
  GestureContext,
  ModifierState,
  ResizeAnchor,
  ResizePose,
  ResizeProposed,
} from '../../../gestures/types';

type P = ResizePose;

function ctx(origin: P, mods: Partial<ModifierState> = {}): GestureContext<P> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', origin]]),
    current: new Map(),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false, ...mods },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {} as never,
    scratch: {},
  };
}

function proposed(pose: P, anchor: ResizeAnchor): ResizeProposed<P> {
  return { pose, anchor };
}

describe('resize/snapToGuides', () => {
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
    const b = snapToGuides<P>({
      getGuides: () => guides,
      tolerance: 6,
      getView: () => ({ x: 0, y: 0, scale: { x: 2, y: 2 } }),
    });
    // 3 world units away — snaps.
    const a = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 0, width: 103, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(a).toEqual({ pose: { x: 0, y: 0, width: 100, height: 50 } });
    // 4 world units away — outside.
    const c = b.onMove!(
      ctx({ x: 0, y: 0, width: 50, height: 50 }),
      proposed({ x: 0, y: 0, width: 104, height: 50 }, { x: 'min', y: 'free' }),
    );
    expect(c).toBeUndefined();
  });
});
